package com.streetfootball.game.progression

import java.time.Duration
import java.time.Instant
import com.streetfootball.game.match.domain.MatchStats

enum class TrainingFocus { SPEED, DRIBBLING, PASSING, FINISHING, DEFENDING, PHYSICAL }

/** Five drills of one focus complete a stat point; each drill starts a profile-wide cooldown. */
object TrainingPolicy {
    const val SESSIONS_PER_POINT = 5
    val cooldown: Duration = Duration.ofMinutes(1)

    fun nextAvailableAt(lastTraining: Instant?): Instant? = lastTraining?.plus(cooldown)

    fun canTrain(now: Instant, lastTraining: Instant?): Boolean =
        lastTraining == null || !now.isBefore(lastTraining.plus(cooldown))

    fun stat(stats: MatchStats, focus: TrainingFocus): Int = when (focus) {
        TrainingFocus.SPEED -> stats.speed
        TrainingFocus.DRIBBLING -> stats.dribbling
        TrainingFocus.PASSING -> stats.passing
        TrainingFocus.FINISHING -> stats.finishing
        TrainingFocus.DEFENDING -> stats.defending
        TrainingFocus.PHYSICAL -> stats.physical
    }

    fun canImprove(stat: Int): Boolean = stat < 99

    fun completeSession(progress: Int): TrainingStep {
        require(progress in 0 until SESSIONS_PER_POINT)
        return TrainingStep((progress + 1) % SESSIONS_PER_POINT, progress == SESSIONS_PER_POINT - 1)
    }
}

data class TrainingStep(val progressAfter: Int, val improvesStat: Boolean)
