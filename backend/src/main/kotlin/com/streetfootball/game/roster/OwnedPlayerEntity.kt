package com.streetfootball.game.roster

import com.streetfootball.game.progression.FatigueChange
import com.streetfootball.game.progression.FatiguePolicy
import com.streetfootball.game.progression.RecoveryMethod
import com.streetfootball.game.progression.RecoveryPolicy
import com.streetfootball.game.progression.RecoveryRuleException
import com.streetfootball.game.progression.RecoveryStatus
import com.streetfootball.game.progression.StatBonuses
import com.streetfootball.game.progression.TrainingFocus
import com.streetfootball.game.progression.TrainingPolicy
import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "owned_player")
class OwnedPlayerEntity(
    @field:Id
    var id: UUID = UUID.randomUUID(),
    @field:Column(name = "profile_id", nullable = false)
    var profileId: UUID = UUID.randomUUID(),
    @field:Column(name = "player_definition_id", nullable = false, length = 64)
    var playerDefinitionId: String = "",
    @field:Column(nullable = false)
    var level: Int = 1,
    @field:Column(nullable = false)
    var xp: Int = 0,
    @field:Column(nullable = false)
    var wins: Int = 0,
    @field:Column(nullable = false)
    var draws: Int = 0,
    @field:Column(nullable = false)
    var losses: Int = 0,
    @field:Column(name = "training_speed", nullable = false)
    var trainingSpeedQuarters: Int = 0,
    @field:Column(name = "training_dribbling", nullable = false)
    var trainingDribblingQuarters: Int = 0,
    @field:Column(name = "training_finishing", nullable = false)
    var trainingFinishingQuarters: Int = 0,
    @field:Column(name = "training_defending", nullable = false)
    var trainingDefendingQuarters: Int = 0,
    @field:Column(name = "training_physical", nullable = false)
    var trainingPhysicalQuarters: Int = 0,
    @field:Column(name = "recruited_at", nullable = false)
    var recruitedAt: Instant = Instant.now(),
    @field:Column(nullable = false)
    var fatigue: Double = 0.0,
    @field:Column(name = "fatigue_updated_at")
    var fatigueUpdatedAt: Instant? = null,
    @field:Column(name = "roster_active", nullable = false)
    var rosterActive: Boolean = true,
    @field:Column(name = "recovery_session_id")
    var recoverySessionId: UUID? = null,
    @field:Column(name = "recovery_station_id", length = 64)
    var recoveryStationId: String? = null,
    @field:Column(name = "recovery_method", length = 16)
    var recoveryMethod: String? = null,
    @field:Column(name = "recovery_ends_at")
    var recoveryEndsAt: Instant? = null,
    @field:Version
    @field:Column(nullable = false)
    var version: Long = 0,
) {
    fun fatigueAt(now: Instant): Double =
        recoveryMethod?.let {
            RecoveryPolicy.recover(fatigue, fatigueUpdatedAt!!, now)
        } ?: FatiguePolicy.recover(fatigue, fatigueUpdatedAt, now)

    fun recoveryAt(now: Instant): RecoveryStatus? =
        recoveryEndsAt?.takeIf { now < it }?.let {
            RecoveryStatus(recoverySessionId!!, recoveryStationId!!, RecoveryMethod.valueOf(recoveryMethod!!), it)
        }

    fun requireAvailable(now: Instant) {
        if (recoveryAt(now) != null) throw RecoveryRuleException("PLAYER_RECOVERING")
    }

    fun clearRecovery() {
        recoverySessionId = null
        recoveryStationId = null
        recoveryMethod = null
        recoveryEndsAt = null
    }

    fun addFatigue(
        cost: Int,
        now: Instant,
    ): FatigueChange {
        requireAvailable(now)
        val change = FatiguePolicy.add(fatigueAt(now), cost, now)
        clearRecovery()
        fatigue = change.after.value
        fatigueUpdatedAt = now
        return change
    }

    // Integer quarter points preserve exact gains and previously earned whole-point bonuses.
    fun trainingBonuses() =
        StatBonuses(
            trainingSpeedQuarters * TrainingPolicy.STAT_GAIN,
            trainingDribblingQuarters * TrainingPolicy.STAT_GAIN,
            trainingFinishingQuarters * TrainingPolicy.STAT_GAIN,
            trainingDefendingQuarters * TrainingPolicy.STAT_GAIN,
            trainingPhysicalQuarters * TrainingPolicy.STAT_GAIN,
        )

    fun increaseTraining(focus: TrainingFocus) {
        when (focus) {
            TrainingFocus.SPEED -> trainingSpeedQuarters++
            TrainingFocus.DRIBBLING -> trainingDribblingQuarters++
            TrainingFocus.FINISHING -> trainingFinishingQuarters++
            TrainingFocus.DEFENDING -> trainingDefendingQuarters++
            TrainingFocus.PHYSICAL -> trainingPhysicalQuarters++
        }
    }
}
