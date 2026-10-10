package com.streetfootball.game.roster

import com.streetfootball.game.challenge.IdempotencyConflictException
import com.streetfootball.game.challenge.OwnedPlayerNotFoundException
import com.streetfootball.game.challenge.PlayerNotOwnedException
import com.streetfootball.game.profile.GameProfileRepository
import com.streetfootball.game.profile.ProfileNotFoundException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class DismissalService(
    private val profiles: GameProfileRepository,
    private val owned: OwnedPlayerRepository,
    private val jdbc: JdbcTemplate,
) {
    @Transactional(readOnly = true)
    fun list(
        profileId: UUID,
        mapId: String,
    ): List<ReleasedPlayer> {
        val profile = profiles.findById(profileId).orElseThrow(::ProfileNotFoundException)
        if (mapId != "benfica" || (profile.currentMapId != null && profile.currentMapId != mapId)) throw InvalidDismissalLocationException()
        return jdbc.query(
            """SELECT r.challenger_id, o.player_definition_id, d.name, o.level, r.map_id, r.x, r.y
            FROM released_player r JOIN owned_player o ON o.id = r.owned_player_id
            JOIN player_definition d ON d.id = o.player_definition_id
            WHERE r.profile_id = ? AND r.map_id = ? AND NOT o.roster_active ORDER BY r.challenger_id""",
            { row, _ ->
                ReleasedPlayer(
                    row.getObject("challenger_id", UUID::class.java),
                    row.getString("player_definition_id"),
                    row.getString("name"),
                    row.getInt("level"),
                    row.getString("map_id"),
                    row.getDouble("x"),
                    row.getDouble("y"),
                )
            },
            profileId,
            mapId,
        )
    }

    @Transactional
    fun dismiss(
        profileId: UUID,
        playerId: UUID,
        key: UUID,
        location: DismissalLocation,
    ): DismissalResponse {
        val profile = profiles.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        val prior =
            jdbc
                .query(
                    "SELECT * FROM dismissal_command WHERE profile_id = ? AND idempotency_key = ?",
                    { row, _ ->
                        DismissalResponse(
                            row.getObject("owned_player_id", UUID::class.java),
                            row.getObject("challenger_id", UUID::class.java),
                            row.getString("map_id"),
                            row.getDouble("x"),
                            row.getDouble("y"),
                        )
                    },
                    profileId,
                    key,
                ).singleOrNull()
        if (prior != null) {
            if (prior.ownedPlayerId != playerId ||
                prior.mapId != location.mapId ||
                prior.x != location.x ||
                prior.y != location.y
            ) {
                throw IdempotencyConflictException()
            }
            return prior
        }
        if (location.mapId != "benfica" ||
            (profile.currentMapId != null && profile.currentMapId != location.mapId) ||
            !location.x.isFinite() ||
            !location.y.isFinite() ||
            location.x !in 16.0..2288.0 ||
            location.y !in 16.0..2672.0
        ) {
            throw InvalidDismissalLocationException()
        }
        val player = owned.findById(playerId).orElseThrow(::OwnedPlayerNotFoundException)
        if (player.profileId != profileId) throw PlayerNotOwnedException()
        if (!player.rosterActive) throw OwnedPlayerNotFoundException()
        player.requireAvailable(java.time.Instant.now())
        val challengerId =
            jdbc
                .query(
                    "SELECT id FROM challenger WHERE player_definition_id = ? AND (profile_id IS NULL OR profile_id = ?) ORDER BY id LIMIT 1",
                    { row, _ -> row.getObject("id", UUID::class.java) },
                    player.playerDefinitionId,
                    profileId,
                ).singleOrNull() ?: player.id.also {
                jdbc.update(
                    "INSERT INTO challenger (id, player_definition_id, map_id, spawn_key, level, profile_id) VALUES (?, ?, ?, ?, ?, ?)",
                    it,
                    player.playerDefinitionId,
                    location.mapId,
                    "released.$it",
                    player.level,
                    profileId,
                )
            }
        player.rosterActive = false
        owned.saveAndFlush(player)
        jdbc.update("DELETE FROM user_lineup WHERE profile_id = ? AND owned_player_id = ?", profileId, playerId)
        jdbc.update(
            """INSERT INTO released_player (owned_player_id, profile_id, challenger_id, map_id, x, y) VALUES (?, ?, ?, ?, ?, ?)
            ON CONFLICT (owned_player_id) DO UPDATE SET challenger_id = EXCLUDED.challenger_id, map_id = EXCLUDED.map_id, x = EXCLUDED.x, y = EXCLUDED.y""",
            playerId,
            profileId,
            challengerId,
            location.mapId,
            location.x,
            location.y,
        )
        jdbc.update(
            "UPDATE challenger_progress SET recruitment_status = 'AVAILABLE', recruitment_by_dismissal = TRUE WHERE profile_id = ? AND challenger_id IN (SELECT id FROM challenger WHERE player_definition_id = ?)",
            profileId,
            player.playerDefinitionId,
        )
        jdbc.update(
            """INSERT INTO challenger_progress (profile_id, challenger_id, recruitment_status, last_played_at, recruitment_by_dismissal) VALUES (?, ?, 'AVAILABLE', now(), TRUE)
            ON CONFLICT (profile_id, challenger_id) DO UPDATE SET recruitment_status = 'AVAILABLE', recruitment_by_dismissal = TRUE""",
            profileId,
            challengerId,
        )
        jdbc.update(
            "INSERT INTO dismissal_command (profile_id, idempotency_key, owned_player_id, challenger_id, map_id, x, y) VALUES (?, ?, ?, ?, ?, ?, ?)",
            profileId,
            key,
            playerId,
            challengerId,
            location.mapId,
            location.x,
            location.y,
        )
        return DismissalResponse(playerId, challengerId, location.mapId, location.x, location.y)
    }
}

data class DismissalResponse(
    val ownedPlayerId: UUID,
    val challengerId: UUID,
    val mapId: String,
    val x: Double,
    val y: Double,
)

data class ReleasedPlayer(
    val id: UUID,
    val playerDefinitionId: String,
    val name: String,
    val level: Int,
    val mapId: String,
    val x: Double,
    val y: Double,
)
