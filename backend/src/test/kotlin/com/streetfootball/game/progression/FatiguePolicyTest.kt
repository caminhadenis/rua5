package com.streetfootball.game.progression

import com.streetfootball.game.match.domain.DuelMatchEngine
import com.streetfootball.game.match.domain.MatchMode
import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchParticipant
import com.streetfootball.game.match.domain.MatchRequest
import com.streetfootball.game.match.domain.MatchStats
import org.junit.jupiter.api.Test
import java.time.Instant
import kotlin.test.assertEquals
import kotlin.test.assertTrue

class FatiguePolicyTest {
    private val now = Instant.parse("2026-10-05T12:00:00Z")

    @Test
    fun `recovery uses real elapsed time including offline time and cannot go below zero`() {
        assertEquals(56.0, FatiguePolicy.recover(68.0, now, now.plusSeconds(180)))
        assertEquals(0.0, FatiguePolicy.recover(100.0, now, now.plusSeconds(1500)))
        assertEquals(68.0, FatiguePolicy.recover(68.0, now, now.minusSeconds(1)))
        assertEquals(0.0, FatiguePolicy.recover(0.0, null, now))
        assertEquals(11.0, FatiguePolicy.recover(12.0, now, now.plusSeconds(15)))
    }

    @Test
    fun `condition boundaries select gradual penalties`() {
        for ((fatigue, penalty) in listOf(
            0.0 to 0,
            29.999 to 0,
            30.0 to 5,
            59.999 to 5,
            60.0 to 10,
            84.999 to 10,
            85.0 to 15,
            100.0 to 15,
        )) {
            assertEquals(penalty, FatiguePolicy.penaltyPercent(fatigue))
        }
        val tired = FatiguePolicy.status(68.0, now)
        assertEquals(now.plusMillis(120001), tired.nextConditionAt)
        assertEquals(5, FatiguePolicy.penaltyPercent(FatiguePolicy.recover(68.0, now, tired.nextConditionAt!!)))
    }

    @Test
    fun `costs saturate at one hundred and a rested athlete can play repeatedly`() {
        val training = FatiguePolicy.add(84.0, FatiguePolicy.TRAINING_COST, now)
        assertEquals(96.0, training.after.value)
        assertEquals(100.0, FatiguePolicy.add(96.0, FatiguePolicy.DUEL_COST, now).after.value)
        assertEquals(listOf(0, 0, 5, 5, 10), (0..4).map { FatiguePolicy.penaltyPercent(it * 18.0) })
    }

    @Test
    fun `all five stats lose the same percentage without changing permanent stats or violating bounds`() {
        val permanent = MatchStats(80, 70, 90, 60, 70)
        assertEquals(MatchStats(72, 63, 81, 54, 63), FatiguePolicy.matchStats(permanent, 68.0))
        assertEquals(MatchStats(80, 70, 90, 60, 70), permanent)
        assertEquals(permanent, FatiguePolicy.matchStats(permanent, 0.0))
        assertEquals(1.0, FatiguePolicy.matchStats(MatchStats(1, 1, 1, 1, 1), 100.0).speed)
    }

    @Test
    fun `fatigue reduces observed wins with the same seeds and engine remains deterministic`() {
        val stats = MatchStats(70, 70, 70, 70, 70)
        val rested = MatchParticipant("home", "a", "Atleta", 1, stats)
        val tired = rested.copy(stats = FatiguePolicy.matchStats(stats, 100.0))
        val away = rested.copy(playerId = "away", playerDefinitionId = "b")
        val engine = DuelMatchEngine()

        fun request(
            player: MatchParticipant,
            seed: Long,
        ) = MatchRequest(MatchMode.DUEL_1V1, listOf(player), listOf(away), seed, "1")

        fun wins(player: MatchParticipant) = (0L until 2000).count { engine.simulate(request(player, it)).outcome == MatchOutcome.WIN }
        val normalWins = wins(rested)
        val tiredWins = wins(tired)
        assertTrue(normalWins > tiredWins + 100, "Rested=$normalWins exhausted=$tiredWins")
        assertEquals(engine.simulate(request(tired, 42)), engine.simulate(request(tired, 42)))
    }
}
