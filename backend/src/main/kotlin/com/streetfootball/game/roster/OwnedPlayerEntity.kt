package com.streetfootball.game.roster

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
    @field:Version
    @field:Column(nullable = false)
    var version: Long = 0,
) {
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
