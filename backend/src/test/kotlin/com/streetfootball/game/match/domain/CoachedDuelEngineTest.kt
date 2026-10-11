package com.streetfootball.game.match.domain

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class CoachedDuelEngineTest {
    private val engine = CoachedDuelEngine()

    private fun request(
        seed: Long,
        home: Int = 50,
        away: Int = 50,
        stadium: Boolean = false,
    ) = MatchRequest(
        if (stadium) MatchMode.STADIUM_1V1 else MatchMode.DUEL_1V1,
        listOf(MatchParticipant("home", "h", "Home", 1, MatchStats(home, home, home, home, home))),
        listOf(MatchParticipant("away", "a", "Away", 1, MatchStats(away, away, away, away, away))),
        seed,
        CoachedDuelEngine.VERSION,
    )

    @Test
    fun `incremental resume is identical to replay with the full instruction history`() {
        val instructions =
            listOf(
                CoachInstruction(),
                CoachInstruction(MatchTempo.FAST, MatchPosture.OFFENSIVE),
                CoachInstruction(MatchTempo.SLOW, MatchPosture.DEFENSIVE),
                CoachInstruction(),
                CoachInstruction(MatchTempo.FAST),
            )
        for (seed in 0L..100L) {
            val input = request(seed)
            var state = engine.start(input)
            for ((index, instruction) in instructions.withIndex()) {
                val next = engine.advance(input, state.copy(), instruction)
                assertEquals(next, CoachedDuelEngine().advance(input, state, instruction))
                assertEquals((index + 1) * 240, next.elapsedSeconds)
                assertEquals(state.events, next.events.take(state.events.size))
                assertTrue(next.homeEffort > state.homeEffort)
                state = next
            }
            assertEquals(engine.result(input, state), engine.simulate(input.copy(coaching = instructions)))
            assertFailsWith<IllegalArgumentException> { engine.advance(input, state, CoachInstruction()) }
        }
    }

    @Test
    fun `tempo changes opportunity frequency and effort while posture changes attack and defense`() {
        fun states(instruction: CoachInstruction) =
            (0L..499L).map { seed ->
                val input = request(seed)
                var state = engine.start(input)
                repeat(5) { state = engine.advance(input, state, instruction) }
                state
            }
        val normal = states(CoachInstruction())
        val fast = states(CoachInstruction(MatchTempo.FAST))
        val slow = states(CoachInstruction(MatchTempo.SLOW))
        assertTrue(fast.sumOf { it.actionIndex } > normal.sumOf { it.actionIndex })
        assertTrue(slow.sumOf { it.actionIndex } < normal.sumOf { it.actionIndex })
        assertTrue(fast.sumOf { it.homeEffort } > normal.sumOf { it.homeEffort })
        assertTrue(slow.sumOf { it.homeEffort } < normal.sumOf { it.homeEffort })
        val offensive = states(CoachInstruction(posture = MatchPosture.OFFENSIVE))
        val defensive = states(CoachInstruction(posture = MatchPosture.DEFENSIVE))

        fun shots(
            states: List<CoachedDuelState>,
            side: MatchSide,
        ) = states.sumOf { s ->
            s.events.count {
                it.side == side &&
                    it.type == MatchEventType.SHOT
            }
        }
        assertTrue(shots(offensive, MatchSide.HOME) > shots(defensive, MatchSide.HOME))
        assertTrue(shots(offensive, MatchSide.AWAY) > shots(defensive, MatchSide.AWAY))
    }

    @Test
    fun `fatigue is smooth bounded and physical endurance reduces effort`() {
        val stats = MatchStats(50, 50, 50, 50, 50)
        assertEquals(stats, CoachedDuelEngine.effectiveStats(stats, 0.0))
        assertTrue(CoachedDuelEngine.effectiveStats(stats, 30.0).speed < CoachedDuelEngine.effectiveStats(stats, 29.9).speed)
        assertTrue(CoachedDuelEngine.effectiveStats(stats, 100.0).finishing < stats.finishing)
        val weak = request(1).let { engine.advance(it, engine.start(it), CoachInstruction()) }
        val strong =
            request(1)
                .let {
                    it.copy(home = listOf(it.home.single().copy(stats = stats.copy(physical = 90.0))))
                }.let { engine.advance(it, engine.start(it), CoachInstruction()) }
        assertTrue(strong.homeEffort < weak.homeEffort)
    }

    @Test
    fun `balance preserves symmetry stronger favorites and upsets with valid scores and penalties`() {
        val equal = (0L..1999L).map { engine.simulate(request(it)) }
        val wins = equal.count { it.outcome == MatchOutcome.WIN }
        val losses = equal.count { it.outcome == MatchOutcome.LOSS }
        assertTrue(wins.toDouble() / (wins + losses) in 0.46..0.54)
        val stronger = (0L..1999L).map { engine.simulate(request(it, 60, 50)) }
        val rate = stronger.count { it.outcome == MatchOutcome.WIN }.toDouble() / stronger.count { it.outcome != MatchOutcome.DRAW }
        assertTrue(rate in 0.65..0.9, "Favorite resolved win rate: $rate")
        assertTrue(stronger.any { it.outcome == MatchOutcome.LOSS })
        val tired = (0L..999L).map { engine.simulate(request(it).copy(homeInitialFatigue = 100.0)) }
        assertTrue(tired.count { it.outcome == MatchOutcome.WIN } < tired.count { it.outcome == MatchOutcome.LOSS })
        for (seed in 0L..499L) {
            val input = request(seed, stadium = true)
            val result = engine.simulate(input)
            assertTrue(result.outcome != MatchOutcome.DRAW)
            assertEquals(result, engine.simulate(input))
            assertEquals(result.homeScore, result.events.count { it.type == MatchEventType.GOAL && it.side == MatchSide.HOME })
            assertEquals(result.awayScore, result.events.count { it.type == MatchEventType.GOAL && it.side == MatchSide.AWAY })
            assertEquals((1..result.events.size).toList(), result.events.map { it.sequence })
            assertTrue(result.events.zipWithNext().all { (a, b) -> a.minute <= b.minute })
            assertTrue(result.events.all { it.actorPlayerId in listOf("home", "away") })
            result.penalties?.let { assertTrue(it.home != it.away && result.homeScore == result.awayScore) }
        }
    }
}
