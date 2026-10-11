package com.streetfootball.game.progression

import com.streetfootball.game.match.domain.MatchStats
import com.streetfootball.game.roster.OwnedPlayerEntity
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
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
    fun `every session improves the stat including saves with a legacy partial group`() {
        for (progress in 0..4) {
            val step = TrainingPolicy.completeSession(progress)
            assertTrue(step.improvesStat)
            assertEquals(0, step.progressAfter)
        }
    }

    @Test
    fun `gain follows the fatigue condition including exact boundaries`() {
        for ((fatigue, units) in listOf(0.0 to 25, 29.99 to 25, 30.0 to 20, 59.99 to 20, 60.0 to 15, 84.99 to 15, 85.0 to 5, 100.0 to 5)) {
            assertEquals(units, TrainingPolicy.gainUnits(fatigue, 50.0))
        }
        assertFailsWith<IllegalArgumentException> { TrainingPolicy.gainUnits(Double.NaN, 50.0) }
        assertFailsWith<IllegalArgumentException> { TrainingPolicy.gainUnits(101.0, 50.0) }
    }

    @Test
    fun `fractional gains accumulate without drift and cap at 99 for every condition`() {
        for (fatigue in listOf(0.0, 30.0, 60.0, 85.0)) {
            val player = OwnedPlayerEntity()
            val base = MatchStats(98, 60, 80, 90, 98)
            var stats = base
            repeat(20) {
                val units = TrainingPolicy.gainUnits(fatigue, stats.speed)
                if (units > 0) player.increaseTraining(TrainingFocus.SPEED, units)
                stats = Progression.effectiveStats(base, 1, player.trainingBonuses())
            }
            assertEquals(99.0, stats.speed)
            assertEquals(base.dribbling, stats.dribbling)
            assertEquals(100, player.trainingSpeedHundredths)
        }
        assertEquals(2, TrainingPolicy.gainUnits(0.0, 98.98))
        assertEquals(0, TrainingPolicy.gainUnits(100.0, 99.0))
    }
}
