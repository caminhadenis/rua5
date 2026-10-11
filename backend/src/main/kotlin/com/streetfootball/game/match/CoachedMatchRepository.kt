package com.streetfootball.game.match

import com.streetfootball.game.match.domain.CoachedDuelState
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import java.sql.ResultSet
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

data class CoachedSession(
    val id: UUID,
    val key: UUID,
    val command: StartCoachedMatch,
    val prepared: PreparedDuel,
    val state: CoachedDuelState,
    val createdAt: Instant,
    val finalMatchId: UUID? = null,
)

@Repository
class CoachedMatchRepository(
    private val jdbc: JdbcTemplate,
    private val json: ObjectMapper,
) {
    private fun read(row: ResultSet) =
        CoachedSession(
            row.getObject("id", UUID::class.java),
            row.getObject("idempotency_key", UUID::class.java),
            json.readValue(row.getString("start_command"), StartCoachedMatch::class.java),
            json.readValue(row.getString("preparation"), PreparedDuel::class.java),
            json.readValue(row.getString("state"), CoachedDuelState::class.java),
            row.getTimestamp("created_at").toInstant(),
            row.getObject("final_match_id", UUID::class.java),
        )

    fun byKey(
        profileId: UUID,
        key: UUID,
    ): CoachedSession? =
        jdbc
            .query(
                "SELECT * FROM coached_match WHERE profile_id = ? AND idempotency_key = ?",
                { row, _ -> read(row) },
                profileId,
                key,
            ).singleOrNull()

    fun get(
        profileId: UUID,
        id: UUID,
    ): CoachedSession =
        jdbc.query("SELECT * FROM coached_match WHERE profile_id = ? AND id = ?", { row, _ -> read(row) }, profileId, id).singleOrNull()
            ?: throw CoachedMatchException("MATCH_NOT_FOUND")

    fun active(profileId: UUID): CoachedSession? =
        jdbc.query("SELECT * FROM coached_match WHERE profile_id = ? AND NOT finished", { row, _ -> read(row) }, profileId).singleOrNull()

    fun insert(session: CoachedSession) {
        jdbc.update(
            """INSERT INTO coached_match(id, profile_id, owned_player_id, idempotency_key, start_command, preparation, state, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?)""",
            session.id,
            session.prepared.profileId,
            session.prepared.ownedPlayerId,
            session.key,
            json.writeValueAsString(session.command),
            json.writeValueAsString(session.prepared),
            json.writeValueAsString(session.state),
            Timestamp.from(session.createdAt),
            Timestamp.from(session.createdAt),
        )
    }

    fun update(
        session: CoachedSession,
        now: Instant,
    ) {
        jdbc.update(
            "UPDATE coached_match SET state = ?::jsonb, preparation = ?::jsonb, finished = ?, final_match_id = ?, updated_at = ? WHERE id = ? AND profile_id = ?",
            json.writeValueAsString(session.state),
            json.writeValueAsString(session.prepared),
            session.finalMatchId != null,
            session.finalMatchId,
            Timestamp.from(now),
            session.id,
            session.prepared.profileId,
        )
    }

    fun prior(
        profileId: UUID,
        key: UUID,
        matchId: UUID,
        command: AdvanceCoachedMatch,
    ): CoachedMatchResponse? =
        jdbc
            .query(
                "SELECT match_id, command, receipt FROM coached_match_command WHERE profile_id = ? AND idempotency_key = ?",
                { row, _ ->
                    if (row.getObject("match_id", UUID::class.java) != matchId ||
                        json.readValue(row.getString("command"), AdvanceCoachedMatch::class.java) != command
                    ) {
                        throw com.streetfootball.game.challenge
                            .IdempotencyConflictException()
                    }
                    json.readValue(row.getString("receipt"), CoachedMatchResponse::class.java)
                },
                profileId,
                key,
            ).singleOrNull()

    fun record(
        profileId: UUID,
        key: UUID,
        matchId: UUID,
        command: AdvanceCoachedMatch,
        response: CoachedMatchResponse,
        now: Instant,
    ) {
        jdbc.update(
            "INSERT INTO coached_match_command(profile_id, idempotency_key, match_id, command, receipt, created_at) VALUES (?, ?, ?, ?::jsonb, ?::jsonb, ?)",
            profileId,
            key,
            matchId,
            json.writeValueAsString(command),
            json.writeValueAsString(response),
            Timestamp.from(now),
        )
    }
}

class CoachedMatchException(
    val code: String,
) : RuntimeException(code)
