package com.streetfootball.game.progression

import com.streetfootball.game.challenge.IdempotencyConflictException
import com.streetfootball.game.challenge.OwnedPlayerNotFoundException
import com.streetfootball.game.challenge.PlayerNotOwnedException
import com.streetfootball.game.match.MatchRepository
import com.streetfootball.game.profile.GameProfileRepository
import com.streetfootball.game.profile.ProfileNotFoundException
import com.streetfootball.game.roster.OwnedPlayerRepository
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.sql.Timestamp
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

data class RecoverySession(
    val id: UUID,
    val ownedPlayerId: UUID,
    val stationId: String,
    val method: RecoveryMethod,
    val startedAt: Instant,
    val completesAt: Instant,
    val cancelledAt: Instant? = null,
)

data class RecoveryReceipt(
    val session: RecoverySession,
    val fatigue: FatigueStatus,
    val policyVersion: String = "1",
)

@Service
class RecoveryService(
    private val profiles: GameProfileRepository,
    private val matches: MatchRepository,
    private val owned: OwnedPlayerRepository,
    private val jdbc: JdbcTemplate,
    private val json: ObjectMapper,
) {
    @Transactional
    fun start(
        profileId: UUID,
        playerId: UUID,
        stationId: String,
        key: UUID,
    ): RecoveryReceipt {
        profiles.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        prior(profileId, key, "START", playerId, stationId)?.let { return it }
        matches.requireIdle(profileId)
        val method = RecoveryPolicy.stations[stationId] ?: throw RecoveryRuleException("RECOVERY_STATION_NOT_FOUND")
        val player = owned.findById(playerId).orElseThrow(::OwnedPlayerNotFoundException)
        if (player.profileId != profileId) throw PlayerNotOwnedException()
        if (!player.rosterActive) throw OwnedPlayerNotFoundException()
        val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
        player.requireAvailable(now)
        val value = player.fatigueAt(now)
        if (value == 0.0) throw RecoveryRuleException("PLAYER_ALREADY_RESTED")
        val occupied =
            jdbc.queryForObject(
                "SELECT count(*) FROM owned_player WHERE profile_id = ? AND recovery_station_id = ? AND recovery_ends_at > ?",
                Int::class.java,
                profileId,
                stationId,
                Timestamp.from(now),
            )!!
        if (occupied > 0) throw RecoveryRuleException("RECOVERY_STATION_OCCUPIED")
        val session = RecoverySession(UUID.randomUUID(), playerId, stationId, method, now, RecoveryPolicy.completesAt(value, now))
        jdbc.update(
            "INSERT INTO recovery_session (id, profile_id, owned_player_id, station_id, method, started_at, completes_at) VALUES (?, ?, ?, ?, ?, ?, ?)",
            session.id,
            profileId,
            playerId,
            stationId,
            method.name,
            Timestamp.from(now),
            Timestamp.from(session.completesAt),
        )
        player.fatigue = value
        player.fatigueUpdatedAt = now
        player.recoverySessionId = session.id
        player.recoveryStationId = stationId
        player.recoveryMethod = method.name
        player.recoveryEndsAt = session.completesAt
        val result = RecoveryReceipt(session, FatiguePolicy.status(value, now, value * 12.0))
        record(profileId, key, "START", playerId, stationId, result)
        return result
    }

    @Transactional
    fun cancel(
        profileId: UUID,
        sessionId: UUID,
        key: UUID,
    ): RecoveryReceipt {
        profiles.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        prior(profileId, key, "CANCEL", sessionId, null)?.let { return it }
        val session =
            jdbc
                .query(
                    "SELECT * FROM recovery_session WHERE id = ? AND profile_id = ?",
                    { row, _ ->
                        RecoverySession(
                            row.getObject("id", UUID::class.java),
                            row.getObject("owned_player_id", UUID::class.java),
                            row.getString("station_id"),
                            RecoveryMethod.valueOf(row.getString("method")),
                            row.getTimestamp("started_at").toInstant(),
                            row.getTimestamp("completes_at").toInstant(),
                            row.getTimestamp("cancelled_at")?.toInstant(),
                        )
                    },
                    sessionId,
                    profileId,
                ).singleOrNull() ?: throw RecoveryRuleException("RECOVERY_SESSION_NOT_FOUND")
        val player = owned.findById(session.ownedPlayerId).orElseThrow(::OwnedPlayerNotFoundException)
        if (player.recoverySessionId != sessionId || session.cancelledAt != null) throw RecoveryRuleException("RECOVERY_SESSION_CHANGED")
        val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
        val value = player.fatigueAt(now)
        player.clearRecovery()
        player.fatigue = value
        player.fatigueUpdatedAt = now
        jdbc.update("UPDATE recovery_session SET cancelled_at = ? WHERE id = ?", Timestamp.from(now), sessionId)
        val result = RecoveryReceipt(session.copy(cancelledAt = now), FatiguePolicy.status(value, now))
        record(profileId, key, "CANCEL", sessionId, null, result)
        return result
    }

    private fun prior(
        profileId: UUID,
        key: UUID,
        action: String,
        targetId: UUID,
        stationId: String?,
    ): RecoveryReceipt? =
        jdbc
            .query(
                "SELECT * FROM recovery_command WHERE profile_id = ? AND idempotency_key = ?",
                { row, _ ->
                    if (row.getString("action") != action ||
                        row.getObject("target_id", UUID::class.java) != targetId ||
                        row.getString("station_id") != stationId
                    ) {
                        throw IdempotencyConflictException()
                    }
                    json.readValue(row.getString("receipt"), RecoveryReceipt::class.java)
                },
                profileId,
                key,
            ).singleOrNull()

    private fun record(
        profileId: UUID,
        key: UUID,
        action: String,
        targetId: UUID,
        stationId: String?,
        receipt: RecoveryReceipt,
    ) {
        jdbc.update(
            "INSERT INTO recovery_command (profile_id, idempotency_key, action, target_id, station_id, receipt) VALUES (?, ?, ?, ?, ?, ?::jsonb)",
            profileId,
            key,
            action,
            targetId,
            stationId,
            json.writeValueAsString(receipt),
        )
    }
}
