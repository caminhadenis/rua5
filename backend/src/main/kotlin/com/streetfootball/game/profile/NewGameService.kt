package com.streetfootball.game.profile

import com.streetfootball.game.challenge.IdempotencyConflictException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.util.UUID

@Service
class NewGameService(
    private val profiles: ProfileService,
    private val jdbc: JdbcTemplate,
    private val json: ObjectMapper,
) {
    @Transactional
    fun start(
        ownerKey: String,
        userId: UUID?,
        key: UUID,
        body: CreateProfileRequest,
    ): GameProfile {
        // Serialize this owner in PostgreSQL; JDBC HTTP-session wrappers are per request.
        jdbc.query("SELECT pg_advisory_xact_lock(hashtextextended(?, 0))", { _, _ -> Unit }, ownerKey)
        val previous =
            jdbc
                .query(
                    "SELECT * FROM new_game_command WHERE owner_key = ? AND idempotency_key = ?",
                    { row, _ ->
                        val original =
                            CreateProfileRequest(
                                row.getString("display_name"),
                                row.getString("primary_color"),
                                row.getString("secondary_color"),
                            )
                        if (original != body) throw IdempotencyConflictException()
                        json.readValue(row.getString("profile_snapshot"), GameProfile::class.java)
                    },
                    ownerKey,
                    key,
                ).singleOrNull()
        if (previous != null) return previous
        val profile = profiles.create(body.displayName, body.primaryColor, body.secondaryColor, userId)
        jdbc.update(
            """INSERT INTO new_game_command
                (owner_key, idempotency_key, display_name, primary_color, secondary_color, profile_id, created_at, profile_snapshot)
                VALUES (?, ?, ?, ?, ?, ?, now(), ?::jsonb)""",
            ownerKey,
            key,
            body.displayName,
            body.primaryColor,
            body.secondaryColor,
            profile.id,
            json.writeValueAsString(profile),
        )
        return profile
    }
}
