package com.streetfootball.game.progression

import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchStats
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class ProgressionTest {
    @Test
    fun `requirements single multiple level ups remainder and cap`() {
        assertEquals(100, Progression.xpForNextLevel(1))
        assertEquals(255, Progression.xpForNextLevel(2))
        assertEquals(LevelProgress(1, 99), Progression.advance(1, 89, 10))
        assertEquals(LevelProgress(2, 0), Progression.advance(1, 90, 10))
        assertEquals(LevelProgress(3, 5), Progression.advance(1, 0, 360))
        assertEquals(LevelProgress(15, 0), Progression.advance(14, 0, Int.MAX_VALUE))
        assertEquals(LevelProgress(15, 0), Progression.advance(15, 0, 100))
        assertFailsWith<IllegalArgumentException> { Progression.advance(0, 0, 1) }
        assertFailsWith<IllegalArgumentException> { Progression.advance(1, 0, -1) }
        assertFailsWith<IllegalArgumentException> { Progression.xpForNextLevel(15) }
    }

    @Test
    fun `victory ladder level gap and non winning attempts decay`() {
        assertEquals(listOf(100, 65, 35, 15, 5, 5), (0..5).map { Progression.reward(MatchOutcome.WIN, 1, 1, it, it) })
        assertEquals(25, Progression.reward(MatchOutcome.DRAW, 1, 1, 0, 0))
        assertEquals(10, Progression.reward(MatchOutcome.LOSS, 1, 1, 0, 0))
        assertEquals(1, Progression.reward(MatchOutcome.DRAW, 1, 1, 0, 4))
        assertEquals(0, Progression.reward(MatchOutcome.LOSS, 1, 1, 0, 4))
        assertEquals(0, Progression.reward(MatchOutcome.WIN, 7, 1, 0, 0))
        assertEquals(0, Progression.reward(MatchOutcome.WIN, 15, 15, 0, 0))
        assertEquals(100, Progression.reward(MatchOutcome.WIN, 1, 7, 0, 0))
        assertTrue((1..7).map { Progression.reward(MatchOutcome.WIN, it, 1, 0, 0) }.zipWithNext().all { (a, b) -> a > b })
    }

    @Test
    fun `growth preserves bases level one and valid stat bounds`() {
        val base = MatchStats(1, 99, 50, 98, 10, 20)
        assertEquals(base, Progression.effectiveStats(base, 1))
        assertEquals(MatchStats(15, 99, 64, 99, 24, 34), Progression.effectiveStats(base, 15))
        assertEquals(MatchStats(2, 99, 51, 99, 11, 21), Progression.effectiveStats(base, 2))
        for (level in 2..15) {
            assertTrue(Progression.effectiveStats(base, level).speed > Progression.effectiveStats(base, level - 1).speed)
        }
        assertEquals(1, base.speed)
    }
}
