package com.streetfootball.game.progression

import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue
import com.streetfootball.game.match.domain.MatchStats

class TrainingPolicyTest {
    @Test
    fun `focused training improves only the selected stat and respects cap`() {
        val base = MatchStats(50, 60, 70, 80, 90, 98)
        val improved = Progression.effectiveStats(base, 1, StatBonuses(dribbling = 1))
        assertEquals(MatchStats(50, 61, 70, 80, 90, 98), improved)
        assertEquals(61, TrainingPolicy.stat(improved, TrainingFocus.DRIBBLING))
        assertTrue(TrainingPolicy.canImprove(98))
        assertFalse(TrainingPolicy.canImprove(99))
        assertEquals(99, Progression.effectiveStats(base, 2, StatBonuses(physical = 1)).physical)
    }

    @Test
    fun `cooldown boundary is inclusive`() {
        val last = Instant.parse("2026-01-01T00:00:00Z")
        assertFalse(TrainingPolicy.canTrain(last.plusSeconds(59), last))
        assertTrue(TrainingPolicy.canTrain(last.plusSeconds(60), last))
        assertTrue(TrainingPolicy.canTrain(last, null))
    }

    @Test
    fun `five sessions complete one stat point and start a new group`() {
        var progress = 0
        repeat(4) {
            val step = TrainingPolicy.completeSession(progress)
            assertFalse(step.improvesStat)
            progress = step.progressAfter
        }
        assertEquals(4, progress)
        val fifth = TrainingPolicy.completeSession(progress)
        assertTrue(fifth.improvesStat)
        assertEquals(0, fifth.progressAfter)
    }
}
