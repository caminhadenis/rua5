package com.streetfootball.game.progression

import com.streetfootball.game.match.domain.MatchStats

enum class TrainingFocus { SPEED, DRIBBLING, FINISHING, DEFENDING, PHYSICAL }

/** Each drill grants a quarter stat point. Fatigue accumulates without a training cooldown. */
object TrainingPolicy {
    const val STAT_GAIN = 0.25

    fun stat(
        stats: MatchStats,
        focus: TrainingFocus,
    ): Double =
        when (focus) {
            TrainingFocus.SPEED -> stats.speed
            TrainingFocus.DRIBBLING -> stats.dribbling
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
