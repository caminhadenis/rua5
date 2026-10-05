package com.streetfootball.game.match.domain

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class StadiumDuelEngineTest {
    private val stats = MatchStats(60, 60, 60, 60, 60)
    private val request =
        MatchRequest(
            MatchMode.STADIUM_1V1,
            listOf(MatchParticipant("h", "home", "Home", 6, stats)),
            listOf(MatchParticipant("a", "away", "Away", 6, stats)),
            1,
            StadiumDuelEngine.VERSION,
        )

    @Test
    fun `deterministic single player duels always resolve ties and preserve goal scores`() {
        val engine = VersionedMatchEngine()
        var ties = 0
        for (seed in 0L..999L) {
            val input = request.copy(seed = seed)
            val result = engine.simulate(input)
            assertEquals(result, engine.simulate(input))
            assertNotEquals(MatchOutcome.DRAW, result.outcome)
            assertEquals(result.homeScore, result.events.count { it.type == MatchEventType.GOAL && it.side == MatchSide.HOME })
            assertEquals(result.awayScore, result.events.count { it.type == MatchEventType.GOAL && it.side == MatchSide.AWAY })
            assertTrue(result.events.all { it.actorPlayerId in listOf("h", "a") })
            assertEquals((1..result.events.size).toList(), result.events.map { it.sequence })
            assertTrue(result.events.zipWithNext().all { (a, b) -> a.minute <= b.minute })
            result.penalties?.let {
                ties++
                assertEquals(result.homeScore, result.awayScore)
                assertNotEquals(it.home, it.away)
                assertEquals(it.home, result.events.count { e -> e.type == MatchEventType.PENALTY_GOAL && e.side == MatchSide.HOME })
                assertEquals(if (it.home > it.away) MatchOutcome.WIN else MatchOutcome.LOSS, result.outcome)
            }
        }
        assertTrue(ties > 0)
        assertFailsWith<IllegalArgumentException> { engine.simulate(request.copy(engineVersion = "2")) }
        assertFailsWith<IllegalArgumentException> { request.copy(home = request.home + request.home) }
    }
}
