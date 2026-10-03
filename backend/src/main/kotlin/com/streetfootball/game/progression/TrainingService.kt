package com.streetfootball.game.progression

import com.streetfootball.game.challenge.OwnedPlayerNotFoundException
import com.streetfootball.game.challenge.PlayerNotOwnedException
import com.streetfootball.game.match.domain.MatchStats
import com.streetfootball.game.profile.GameProfileRepository
import com.streetfootball.game.profile.ProfileNotFoundException
import com.streetfootball.game.roster.OwnedPlayerRepository
import com.streetfootball.game.roster.PlayerDefinitionRepository
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
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
    val statBefore: Int?,
    val statAfter: Int?,
    val progressBefore: Int?,
    val progressAfter: Int?,
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
    private val ownedPlayers: OwnedPlayerRepository,
    private val definitions: PlayerDefinitionRepository,
    private val jdbc: JdbcTemplate,
) {
    @Transactional(readOnly = true)
    fun status(profileId: UUID): TrainingStatus {
        if (!profiles.existsById(profileId)) throw ProfileNotFoundException()
        val progress =
            jdbc.query(
                """SELECT p.owned_player_id, p.focus, p.sessions_completed
               FROM owned_player_training_progress p JOIN owned_player o ON o.id = p.owned_player_id
               WHERE o.profile_id = ? ORDER BY p.owned_player_id, p.focus""",
                { row, _ ->
                    TrainingProgress(
                        row.getObject("owned_player_id", UUID::class.java),
                        TrainingFocus.valueOf(row.getString("focus")),
                        row.getInt("sessions_completed"),
                    )
                },
                profileId,
            )
        val cooldowns =
            jdbc.query(
                """SELECT owned_player_id, MAX(trained_at) AS last_training FROM training_session
               WHERE profile_id = ? GROUP BY owned_player_id ORDER BY owned_player_id""",
                { row, _ ->
                    val last = row.getTimestamp("last_training").toInstant()
                    TrainingCooldown(
                        row.getObject("owned_player_id", UUID::class.java),
                        requireNotNull(TrainingPolicy.nextAvailableAt(last)),
                    )
                },
                profileId,
            )
        return TrainingStatus(cooldowns, progress)
    }

    private fun lastTraining(ownedPlayerId: UUID): Instant? =
        jdbc
            .query(
                "SELECT trained_at FROM training_session WHERE owned_player_id = ? ORDER BY trained_at DESC LIMIT 1",
                { row, _ -> row.getTimestamp(1).toInstant() },
                ownedPlayerId,
            ).singleOrNull()

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
                                if (row.getObject("stat_before") == null) java.time.Duration.ofSeconds(90) else TrainingPolicy.cooldown,
                            ),
                            row.getObject("stat_before") as Int?,
                            row.getObject("stat_after") as Int?,
                            (row.getObject("progress_before") as Number?)?.toInt(),
                            (row.getObject("progress_after") as Number?)?.toInt(),
                        )
                    },
                    profileId,
                    key,
                ).singleOrNull()
        if (prior != null) {
            if (prior.ownedPlayerId != playerId || prior.focus != focus) throw TrainingIdempotencyConflictException()
            return prior
        }
        val owned = ownedPlayers.findById(playerId).orElseThrow(::OwnedPlayerNotFoundException)
        if (owned.profileId != profileId) throw PlayerNotOwnedException()
        val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
        val last = lastTraining(playerId)
        if (!TrainingPolicy.canTrain(now, last)) throw TrainingCooldownException(requireNotNull(TrainingPolicy.nextAvailableAt(last)))
        val definition = definitions.findById(owned.playerDefinitionId).orElseThrow(::OwnedPlayerNotFoundException)
        val base =
            MatchStats(
                definition.speed,
                definition.dribbling,
                definition.passing,
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
        if (step.improvesStat) owned.increaseTraining(focus)
        val after = TrainingPolicy.stat(Progression.effectiveStats(base, owned.level, owned.trainingBonuses()), focus)
        jdbc.update(
            """INSERT INTO owned_player_training_progress (owned_player_id, focus, sessions_completed) VALUES (?, ?, ?)
               ON CONFLICT (owned_player_id, focus) DO UPDATE SET sessions_completed = EXCLUDED.sessions_completed""",
            playerId,
            focus.name,
            step.progressAfter,
        )
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
                now.plus(TrainingPolicy.cooldown),
                before,
                after,
                progressBefore,
                step.progressAfter,
            )
        jdbc.update(
            """INSERT INTO training_session (profile_id, idempotency_key, owned_player_id, focus, xp_awarded,
                previous_level, current_level, previous_xp, current_xp, trained_at, stat_before, stat_after, progress_before, progress_after)
                VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)""",
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
        )
        return result
    }
}

class TrainingCooldownException(
    val nextAvailableAt: Instant,
) : RuntimeException()

class TrainingStatMaxException : RuntimeException()

class TrainingIdempotencyConflictException : RuntimeException()
