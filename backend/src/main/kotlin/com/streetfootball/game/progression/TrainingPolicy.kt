package com.streetfootball.game.progression

import com.streetfootball.game.match.domain.MatchStats
import java.time.Duration
import java.time.Instant

enum class TrainingFocus { SPEED, DRIBBLING, PASSING, FINISHING, DEFENDING, PHYSICAL }

/** Each drill grants a quarter stat point; each athlete has an independent cooldown. */
object TrainingPolicy {
    const val STAT_GAIN = 0.25
    val cooldown: Duration = Duration.ofMinutes(1)

    fun nextAvailableAt(lastTraining: Instant?): Instant? = lastTraining?.plus(cooldown)

    fun canTrain(
        now: Instant,
        lastTraining: Instant?,
    ): Boolean = lastTraining == null || !now.isBefore(lastTraining.plus(cooldown))

    fun stat(
        stats: MatchStats,
        focus: TrainingFocus,
    ): Double =
        when (focus) {
            TrainingFocus.SPEED -> stats.speed
            TrainingFocus.DRIBBLING -> stats.dribbling
            TrainingFocus.PASSING -> stats.passing
            TrainingFocus.FINISHING -> stats.finishing
            TrainingFocus.DEFENDING -> stats.defending
            TrainingFocus.PHYSICAL -> stats.physical
        }

    fun canImprove(stat: Double): Boolean = stat < 99

    fun completeSession(progress: Int): TrainingStep {
        // Accept partial groups from older saves and clear them without retroactive rewards.
        require(progress in 0..4)
        return TrainingStep(0, true)
    }
}

data class TrainingStep(
    val progressAfter: Int,
    val improvesStat: Boolean,
)
