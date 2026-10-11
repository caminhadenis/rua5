package com.streetfootball.game.progression

import com.streetfootball.game.match.domain.MatchStats
import kotlin.math.roundToInt

enum class TrainingFocus { SPEED, DRIBBLING, FINISHING, DEFENDING, PHYSICAL }

/** Gains use the recovered fatigue before the drill; persistence counts hundredths of a point. */
object TrainingPolicy {
    const val UNITS_PER_POINT = 100

    fun gainUnits(
        fatigue: Double,
        stat: Double,
    ): Int {
        require(stat.isFinite() && stat in 1.0..99.0)
        val gain =
            when (FatiguePolicy.condition(fatigue)) {
                FatigueCondition.RESTED -> 25
                FatigueCondition.TIRED -> 20
                FatigueCondition.VERY_TIRED -> 15
                FatigueCondition.EXHAUSTED -> 5
            }
        return minOf(gain, ((99 - stat) * UNITS_PER_POINT).roundToInt())
    }

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
