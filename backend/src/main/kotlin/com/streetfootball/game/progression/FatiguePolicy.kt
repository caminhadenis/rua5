package com.streetfootball.game.progression

import com.streetfootball.game.match.domain.MatchStats
import java.time.Duration
import java.time.Instant
import kotlin.math.ceil

enum class FatigueCondition { RESTED, TIRED, VERY_TIRED, EXHAUSTED }

data class FatigueStatus(
    val value: Double,
    val condition: FatigueCondition,
    val penaltyPercent: Int,
    val nextConditionAt: Instant?,
    val fullyRecoveredAt: Instant?,
)

data class FatigueChange(
    val before: FatigueStatus,
    val after: FatigueStatus,
    val gained: Int,
    val policyVersion: String = "1",
)

/** Time is an explicit input. Recovery never depends on browser time or an engine clock. */
object FatiguePolicy {
    const val TRAINING_COST = 12
    const val DUEL_COST = 18
    private const val MILLIS_PER_POINT = 15_000.0 // Four points per real minute.

    fun recover(
        value: Double,
        reference: Instant?,
        now: Instant,
    ): Double {
        require(value.isFinite() && value in 0.0..100.0)
        if (reference == null) return value
        val elapsed = Duration.between(reference, now).toMillis().coerceAtLeast(0)
        return (value - elapsed / MILLIS_PER_POINT).coerceAtLeast(0.0)
    }

    fun penaltyPercent(value: Double): Int {
        require(value.isFinite() && value in 0.0..100.0)
        return when {
            value < 30 -> 0
            value < 60 -> 5
            value < 85 -> 10
            else -> 15
        }
    }

    fun condition(value: Double): FatigueCondition =
        when (penaltyPercent(value)) {
            15 -> FatigueCondition.EXHAUSTED
            10 -> FatigueCondition.VERY_TIRED
            5 -> FatigueCondition.TIRED
            else -> FatigueCondition.RESTED
        }

    fun status(
        value: Double,
        now: Instant,
        pointsPerMinute: Double = 4.0,
    ): FatigueStatus {
        require(pointsPerMinute.isFinite() && pointsPerMinute > 0)
        val millisPerPoint = 60_000 / pointsPerMinute
        val penalty = penaltyPercent(value)
        val threshold =
            when (penalty) {
                15 -> 85
                10 -> 60
                5 -> 30
                else -> null
            }
        return FatigueStatus(
            value,
            condition(value),
            penalty,
            // A boundary itself still belongs to the more tired condition.
            threshold?.let { now.plusMillis(ceil((value - it) * millisPerPoint).toLong() + 1) },
            if (value == 0.0) null else now.plusMillis(ceil(value * millisPerPoint).toLong()),
        )
    }

    fun add(
        value: Double,
        cost: Int,
        now: Instant,
    ): FatigueChange {
        require(cost >= 0)
        return FatigueChange(status(value, now), status((value + cost).coerceAtMost(100.0), now), cost)
    }

    fun matchStats(
        permanent: MatchStats,
        value: Double,
    ): MatchStats {
        val multiplier = 1 - penaltyPercent(value) / 100.0

        fun reduce(stat: Double) = (stat * multiplier).coerceIn(1.0, 99.0)
        return MatchStats(
            reduce(permanent.speed),
            reduce(permanent.dribbling),
            reduce(permanent.finishing),
            reduce(permanent.defending),
            reduce(permanent.physical),
        )
    }
}
