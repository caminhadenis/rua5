package com.streetfootball.game.challenge

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.util.UUID

data class Challenger(
    val id: UUID,
    val playerDefinitionId: String,
    val mapId: String,
    val spawnKey: String,
    val level: Int,
    val enabled: Boolean,
    val releasedOwnedPlayerId: UUID? = null,
)

@Repository
class ChallengerRepository(
    private val jdbc: JdbcTemplate,
) {
    fun findForProfile(
        profileId: UUID,
        id: UUID,
    ): Challenger? =
        jdbc
            .query(
                """SELECT c.id, c.player_definition_id, COALESCE(r.map_id, c.map_id) AS map_id,
                c.spawn_key, COALESCE(o.level, c.level) AS level, c.enabled, r.owned_player_id
                FROM challenger c
                LEFT JOIN released_player r ON r.challenger_id = c.id AND r.profile_id = ?
                LEFT JOIN owned_player o ON o.id = r.owned_player_id
                WHERE c.id = ? AND (c.profile_id IS NULL OR c.profile_id = ?)""",
                { row, _ ->
                    Challenger(
                        row.getObject("id", UUID::class.java),
                        row.getString("player_definition_id"),
                        row.getString("map_id"),
                        row.getString("spawn_key"),
                        row.getInt("level"),
                        row.getBoolean("enabled"),
                        row.getObject("owned_player_id", UUID::class.java),
                    )
                },
                profileId,
                id,
                profileId,
            ).singleOrNull()

    fun findById(id: UUID): Challenger? =
        jdbc
            .query(
                "SELECT id, player_definition_id, map_id, spawn_key, level, enabled FROM challenger WHERE id = ?",
                { row, _ ->
                    Challenger(
                        row.getObject("id", UUID::class.java),
                        row.getString("player_definition_id"),
                        row.getString("map_id"),
                        row.getString("spawn_key"),
                        row.getInt("level"),
                        row.getBoolean("enabled"),
                    )
                },
                id,
            ).singleOrNull()
}
