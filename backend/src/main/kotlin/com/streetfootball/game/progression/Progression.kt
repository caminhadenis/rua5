package com.streetfootball.game.progression

import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchStats
import kotlin.math.pow
import kotlin.math.roundToInt

/** MVP balancing, independent of persistence and HTTP. XP is the remainder in the current level. */
object Progression {
    const val MAX_LEVEL = 15

    fun xpForNextLevel(level: Int): Int {
        require(level in 1 until MAX_LEVEL)
        return (100 * level.toDouble().pow(1.35)).roundToInt()
    }

    fun reward(
        outcome: MatchOutcome,
        level: Int,
        opponentLevel: Int,
        previousWins: Int,
        previousAttempts: Int,
    ): Int {
        require(level in 1..MAX_LEVEL && opponentLevel in 1..MAX_LEVEL)
        require(previousWins in 0..previousAttempts)
        if (level == MAX_LEVEL) return 0
        val base =
            when (outcome) {
                MatchOutcome.WIN -> 100
                MatchOutcome.DRAW -> 25
                MatchOutcome.LOSS -> 10
            }
        // Wins use the specified victory ladder; draws/losses also decay to avoid farming them.
        val repetitions = if (outcome == MatchOutcome.WIN) previousWins else previousAttempts
        val repeatPercent = listOf(100, 65, 35, 15, 5)[repetitions.coerceAtMost(4)]
        val levelPercent = ((6 - (level - opponentLevel).coerceAtLeast(0)).coerceAtLeast(0) * 100) / 6
        return base * repeatPercent * levelPercent / 10_000
    }

    fun advance(
        level: Int,
        xp: Int,
        awarded: Int,
    ): LevelProgress {
        require(level in 1..MAX_LEVEL && xp >= 0 && awarded >= 0)
        var currentLevel = level
        var remaining = xp.toLong() + awarded
        while (currentLevel < MAX_LEVEL && remaining >= xpForNextLevel(currentLevel)) {
            remaining -= xpForNextLevel(currentLevel)
            currentLevel++
        }
        return LevelProgress(currentLevel, if (currentLevel == MAX_LEVEL) 0 else remaining.toInt())
    }

    // Every level grants one point per stat, starting at level two. Base stats are never mutated.
    fun effectiveStats(
        base: MatchStats,
        level: Int,
        bonuses: StatBonuses = StatBonuses(),
    ): MatchStats {
        require(level in 1..MAX_LEVEL)
        val growth = level - 1

        fun grow(
            stat: Int,
            bonus: Int,
        ) = (stat + growth + bonus).coerceIn(1, 99)
        return MatchStats(
            grow(base.speed, bonuses.speed),
            grow(base.dribbling, bonuses.dribbling),
            grow(base.passing, bonuses.passing),
            grow(base.finishing, bonuses.finishing),
            grow(base.defending, bonuses.defending),
            grow(base.physical, bonuses.physical),
        )
    }
}

data class StatBonuses(
    val speed: Int = 0,
    val dribbling: Int = 0,
    val passing: Int = 0,
    val finishing: Int = 0,
    val defending: Int = 0,
    val physical: Int = 0,
) {
    init {
        require(listOf(speed, dribbling, passing, finishing, defending, physical).all { it in 0..98 })
    }
}

data class LevelProgress(
    val level: Int,
    val xp: Int,
)
