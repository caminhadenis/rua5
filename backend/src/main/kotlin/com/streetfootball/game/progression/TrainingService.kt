package com.streetfootball.game.progression

import com.streetfootball.game.challenge.OwnedPlayerNotFoundException
import com.streetfootball.game.challenge.PlayerNotOwnedException
import com.streetfootball.game.match.MatchRepository
import com.streetfootball.game.match.domain.MatchStats
import com.streetfootball.game.profile.GameProfileRepository
import com.streetfootball.game.profile.ProfileNotFoundException
import com.streetfootball.game.roster.OwnedPlayerRepository
import com.streetfootball.game.roster.PlayerDefinitionRepository
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import tools.jackson.databind.ObjectMapper
import java.sql.Timestamp
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

data class TrainingResult(
    val ownedPlayerId: UUID,
    val focus: TrainingFocus,
    val xpAwarded: Int,
    val previousLevel: Int,
    val currentLevel: Int,
    val previousXp: Int,
    val currentXp: Int,
    val xpToNextLevel: Int?,
    val nextAvailableAt: Instant,
    val statBefore: Double?,
    val statAfter: Double?,
    val progressBefore: Int?,
    val progressAfter: Int?,
    val fatigue: FatigueChange? = null,
)

data class TrainingProgress(
    val ownedPlayerId: UUID,
    val focus: TrainingFocus,
    val completed: Int,
)

data class TrainingCooldown(
    val ownedPlayerId: UUID,
    val nextAvailableAt: Instant,
)

data class TrainingStatus(
    val cooldowns: List<TrainingCooldown>,
    val progress: List<TrainingProgress>,
)

@Service
class TrainingService(
    private val profiles: GameProfileRepository,
    private val matches: MatchRepository,
    private val ownedPlayers: OwnedPlayerRepository,
    private val definitions: PlayerDefinitionRepository,
    private val jdbc: JdbcTemplate,
    private val json: ObjectMapper,
) {
    @Transactional(readOnly = true)
    fun status(profileId: UUID): TrainingStatus {
        if (!profiles.existsById(profileId)) throw ProfileNotFoundException()
        val progress =
            jdbc.query(
                """SELECT p.owned_player_id, p.focus, p.sessions_completed
               FROM owned_player_training_progress p JOIN owned_player o ON o.id = p.owned_player_id
               WHERE o.profile_id = ? AND o.roster_active ORDER BY p.owned_player_id, p.focus""",
                { row, _ ->
                    TrainingProgress(
                        row.getObject("owned_player_id", UUID::class.java),
                        TrainingFocus.valueOf(row.getString("focus")),
                        row.getInt("sessions_completed"),
                    )
                },
                profileId,
            )
        // Legacy response field retained; training no longer has an availability delay.
        return TrainingStatus(emptyList(), progress)
    }

    @Transactional
    fun train(
        profileId: UUID,
        playerId: UUID,
        focus: TrainingFocus,
        key: UUID,
    ): TrainingResult {
        profiles.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        val prior =
            jdbc
                .query(
                    "SELECT * FROM training_session WHERE profile_id = ? AND idempotency_key = ?",
                    { row, _ ->
                        TrainingResult(
                            row.getObject("owned_player_id", UUID::class.java),
                            TrainingFocus.valueOf(row.getString("focus")),
                            row.getInt("xp_awarded"),
                            row.getInt("previous_level"),
                            row.getInt("current_level"),
                            row.getInt("previous_xp"),
                            row.getInt("current_xp"),
                            if (row.getInt("current_level") ==
                                Progression.MAX_LEVEL
                            ) {
                                null
                            } else {
                                Progression.xpForNextLevel(row.getInt("current_level"))
                            },
                            row.getTimestamp("trained_at").toInstant().plus(
                                java.time.Duration.ofSeconds(row.getLong("cooldown_seconds")),
                            ),
                            (row.getObject("stat_before") as Number?)?.toDouble(),
                            (row.getObject("stat_after") as Number?)?.toDouble(),
                            (row.getObject("progress_before") as Number?)?.toInt(),
                            (row.getObject("progress_after") as Number?)?.toInt(),
                            row.getString("fatigue_change")?.let { json.readValue(it, FatigueChange::class.java) },
                        )
                    },
                    profileId,
                    key,
                ).singleOrNull()
        if (prior != null) {
            if (prior.ownedPlayerId != playerId || prior.focus != focus) throw TrainingIdempotencyConflictException()
            return prior
        }
        matches.requireIdle(profileId)
        val owned = ownedPlayers.findById(playerId).orElseThrow(::OwnedPlayerNotFoundException)
        if (owned.profileId != profileId) throw PlayerNotOwnedException()
        if (!owned.rosterActive) throw OwnedPlayerNotFoundException()
        val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
        owned.requireAvailable(now)
        val definition = definitions.findById(owned.playerDefinitionId).orElseThrow(::OwnedPlayerNotFoundException)
        val base =
            MatchStats(
                definition.speed,
                definition.dribbling,
                definition.finishing,
                definition.defending,
                definition.physical,
            )
        val before = TrainingPolicy.stat(Progression.effectiveStats(base, owned.level, owned.trainingBonuses()), focus)
        if (!TrainingPolicy.canImprove(before)) throw TrainingStatMaxException()
        val progressBefore =
            jdbc
                .query(
                    "SELECT sessions_completed FROM owned_player_training_progress WHERE owned_player_id = ? AND focus = ?",
                    { row, _ -> row.getInt(1) },
                    playerId,
                    focus.name,
                ).singleOrNull() ?: 0
        val step = TrainingPolicy.completeSession(progressBefore)
        if (step.improvesStat) owned.increaseTraining(focus, TrainingPolicy.gainUnits(owned.fatigueAt(now), before))
        val after = TrainingPolicy.stat(Progression.effectiveStats(base, owned.level, owned.trainingBonuses()), focus)
        jdbc.update(
            """INSERT INTO owned_player_training_progress (owned_player_id, focus, sessions_completed) VALUES (?, ?, ?)
               ON CONFLICT (owned_player_id, focus) DO UPDATE SET sessions_completed = EXCLUDED.sessions_completed""",
            playerId,
            focus.name,
            step.progressAfter,
        )
        val fatigue = owned.addFatigue(FatiguePolicy.TRAINING_COST, now)
        val result =
            TrainingResult(
                playerId,
                focus,
                0,
                owned.level,
                owned.level,
                owned.xp,
                owned.xp,
                if (owned.level == Progression.MAX_LEVEL) null else Progression.xpForNextLevel(owned.level),
                now,
                before,
                after,
                progressBefore,
                step.progressAfter,
                fatigue,
            )
        jdbc.update(
            """INSERT INTO training_session (profile_id, idempotency_key, owned_player_id, focus, xp_awarded,
                previous_level, current_level, previous_xp, current_xp, trained_at, stat_before, stat_after, progress_before, progress_after, cooldown_seconds, fatigue_change)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb)""",
            profileId,
            key,
            playerId,
            focus.name,
            0,
            result.previousLevel,
            result.currentLevel,
            result.previousXp,
            result.currentXp,
            Timestamp.from(now),
            before,
            after,
            progressBefore,
            step.progressAfter,
            0,
            json.writeValueAsString(fatigue),
        )
        return result
    }
}

class TrainingStatMaxException : RuntimeException()

class TrainingIdempotencyConflictException : RuntimeException()
