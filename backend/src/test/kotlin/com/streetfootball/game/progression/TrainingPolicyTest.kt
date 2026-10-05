package com.streetfootball.game.progression

import com.streetfootball.game.match.domain.MatchStats
import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertFalse
import kotlin.test.assertTrue

class TrainingPolicyTest {
    @Test
    fun `focused training improves only the selected stat and respects cap`() {
        val base = MatchStats(50, 60, 80, 90, 98)
        val improved = Progression.effectiveStats(base, 1, StatBonuses(dribbling = 0.25))
        assertEquals(MatchStats(50.0, 60.25, 80.0, 90.0, 98.0), improved)
        assertEquals(60.25, TrainingPolicy.stat(improved, TrainingFocus.DRIBBLING))
        assertTrue(TrainingPolicy.canImprove(98.75))
        assertFalse(TrainingPolicy.canImprove(99.0))
        assertEquals(99.0, Progression.effectiveStats(base, 2, StatBonuses(physical = 0.25)).physical)
    }

    @Test
    fun `cooldown boundary is inclusive`() {
        val last = Instant.parse("2026-01-01T00:00:00Z")
        assertFalse(TrainingPolicy.canTrain(last.plusSeconds(59), last))
        assertTrue(TrainingPolicy.canTrain(last.plusSeconds(60), last))
        assertTrue(TrainingPolicy.canTrain(last, null))
    }

    @Test
    fun `every session grants a quarter stat point including saves with a legacy partial group`() {
        for (progress in 0..4) {
            val step = TrainingPolicy.completeSession(progress)
            assertTrue(step.improvesStat)
            assertEquals(0, step.progressAfter)
        }
    }
}
