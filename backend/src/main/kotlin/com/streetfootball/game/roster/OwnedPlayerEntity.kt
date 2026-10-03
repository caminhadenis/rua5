package com.streetfootball.game.roster

import com.streetfootball.game.progression.StatBonuses
import com.streetfootball.game.progression.TrainingFocus
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
    var trainingSpeed: Int = 0,
    @field:Column(name = "training_dribbling", nullable = false)
    var trainingDribbling: Int = 0,
    @field:Column(name = "training_passing", nullable = false)
    var trainingPassing: Int = 0,
    @field:Column(name = "training_finishing", nullable = false)
    var trainingFinishing: Int = 0,
    @field:Column(name = "training_defending", nullable = false)
    var trainingDefending: Int = 0,
    @field:Column(name = "training_physical", nullable = false)
    var trainingPhysical: Int = 0,
    @field:Column(name = "recruited_at", nullable = false)
    var recruitedAt: Instant = Instant.now(),
    @field:Version
    @field:Column(nullable = false)
    var version: Long = 0,
) {
    fun trainingBonuses() =
        StatBonuses(trainingSpeed, trainingDribbling, trainingPassing, trainingFinishing, trainingDefending, trainingPhysical)

    fun increaseTraining(focus: TrainingFocus) {
        when (focus) {
            TrainingFocus.SPEED -> trainingSpeed++
            TrainingFocus.DRIBBLING -> trainingDribbling++
            TrainingFocus.PASSING -> trainingPassing++
            TrainingFocus.FINISHING -> trainingFinishing++
            TrainingFocus.DEFENDING -> trainingDefending++
            TrainingFocus.PHYSICAL -> trainingPhysical++
        }
    }
}
