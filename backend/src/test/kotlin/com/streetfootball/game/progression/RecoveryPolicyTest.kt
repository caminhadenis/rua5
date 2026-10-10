package com.streetfootball.game.progression

import com.streetfootball.game.roster.OwnedPlayerEntity
import org.junit.jupiter.api.Test
import java.time.Instant
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNull

class RecoveryPolicyTest {
    private val now = Instant.parse("2026-10-09T12:00:00Z")

    @Test
    fun `bed and ice recover fully in five seconds without stacking rates or negative fatigue`() {
        assertEquals(96.0, FatiguePolicy.recover(100.0, now, now.plusSeconds(60)))
        assertEquals(80.0, RecoveryPolicy.recover(100.0, now, now.plusSeconds(1)))
        assertEquals(40.0, RecoveryPolicy.recover(100.0, now, now.plusSeconds(3)))
        assertEquals(100.0, RecoveryPolicy.recover(100.0, now, now.minusSeconds(60)))
        assertEquals(0.0, RecoveryPolicy.recover(100.0, now, now.plusSeconds(5)))
        assertEquals(0.0, RecoveryPolicy.recover(100.0, now, now.plusSeconds(1500)))
        assertEquals(now.plusSeconds(5), RecoveryPolicy.completesAt(100.0, now))
        assertEquals(now.plusSeconds(5), RecoveryPolicy.completesAt(10.0, now))
        assertFailsWith<IllegalArgumentException> { RecoveryPolicy.recover(Double.NaN, now, now) }
    }

    @Test
    fun `treatment persists while offline and releases athlete exactly at its deadline`() {
        val player =
            OwnedPlayerEntity(
                fatigue = 100.0,
                fatigueUpdatedAt = now,
                recoveryMethod = "ICE_BATH",
                recoverySessionId = UUID.randomUUID(),
                recoveryStationId = "benfica.recovery.ice.01",
                recoveryEndsAt = now.plusSeconds(5),
            )
        assertEquals("PLAYER_RECOVERING", assertFailsWith<RecoveryRuleException> { player.requireAvailable(now.plusMillis(4950)) }.code)
        assertEquals(1.0, player.fatigueAt(now.plusMillis(4950)), 0.000001)
        player.requireAvailable(now.plusSeconds(5))
        assertNull(player.recoveryAt(now.plusSeconds(5)))
        val change = player.addFatigue(FatiguePolicy.TRAINING_COST, now.plusSeconds(110))
        assertEquals(0.0, change.before.value)
        assertEquals(12.0, change.after.value)
        assertNull(player.recoveryMethod)
        assertEquals(8.0, player.fatigueAt(now.plusSeconds(170)))
    }

    @Test
    fun `fatigue projections use active treatment speed while penalties stay the same`() {
        val status = FatiguePolicy.status(90.0, now, 90.0 / 5 * 60)
        assertEquals(now.plusMillis(279), status.nextConditionAt)
        assertEquals(now.plusSeconds(5), status.fullyRecoveredAt)
        assertEquals(15, status.penaltyPercent)
        assertEquals(5, RecoveryPolicy.stations.size)
    }
}
