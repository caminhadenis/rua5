package com.streetfootball.game.match.domain

import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

class StadiumMatchEngineTest {
    private val engine = VersionedMatchEngine()

    private fun input(seed: Long = 0) =
        MatchRequest(
            MatchMode.STADIUM_5V5,
            team("h"),
            team("a"),
            seed,
            StadiumMatchEngine.VERSION,
        )

    private fun team(prefix: String) =
        (1..5).map {
            MatchParticipant("$prefix$it", "$prefix$it", "$prefix$it", 6, MatchStats(60, 60, 60, 60, 60, 60))
        }

    @Test
    fun `seeds reproduce valid timelines with real actors goals and deterministic penalties`() {
        var shootouts = 0
        val actors = mutableSetOf<String>()
        for (seed in 0L..999L) {
            val request = input(seed)
            val result = engine.simulate(request)
            assertEquals(result, engine.simulate(request))
            assertNotEquals(MatchOutcome.DRAW, result.outcome)
            val ids = (request.home + request.away).map { it.playerId }.toSet()
            assertEquals((1..result.events.size).toList(), result.events.map { it.sequence })
            assertEquals(result.events.map { it.minute }.sorted(), result.events.map { it.minute })
            assertTrue(result.events.all { it.actorPlayerId in ids && (it.targetPlayerId == null || it.targetPlayerId in ids) })
            for (side in MatchSide.entries) {
                val score = if (side == MatchSide.HOME) result.homeScore else result.awayScore
                assertEquals(score, result.events.count { it.type == MatchEventType.GOAL && it.side == side })
                assertEquals(score, (if (side == MatchSide.HOME) result.statistics.home else result.statistics.away).goals)
            }
            actors += result.events.map { it.actorPlayerId }
            result.penalties?.let {
                shootouts++
                assertEquals(result.homeScore, result.awayScore)
                assertNotEquals(it.home, it.away)
                assertEquals(it.home, result.events.count { e -> e.type == MatchEventType.PENALTY_GOAL && e.side == MatchSide.HOME })
                assertEquals(it.away, result.events.count { e -> e.type == MatchEventType.PENALTY_GOAL && e.side == MatchSide.AWAY })
                assertEquals(it.home > it.away, result.outcome == MatchOutcome.WIN)
            }
            assertTrue(result.events.size < 250)
        }
        assertTrue(shootouts > 0)
        assertEquals(10, actors.size)
    }

    @Test
    fun `all five stats and abstract goalkeeper affect simulation without adding a participant`() {
        val baseline = (0L..99).map { engine.simulate(input(it)) }
        for (index in 0..4) {
            val changed =
                (0L..99).map { seed ->
                    val request = input(seed)
                    engine.simulate(
                        request.copy(
                            home =
                                request.home.mapIndexed { i, p ->
                                    if (i ==
                                        index
                                    ) {
                                        p.copy(stats = MatchStats(99, 99, 99, 99, 99, 99))
                                    } else {
                                        p
                                    }
                                },
                        ),
                    )
                }
            assertNotEquals(baseline, changed)
        }
        assertNotEquals(baseline, (0L..99).map { engine.simulate(input(it).copy(awayKeeperBase = 90)) })
    }

    @Test
    fun `participant counts identifiers stats and versions are validated`() {
        assertFailsWith<IllegalArgumentException> { input().copy(home = team("h").take(4)) }
        assertFailsWith<IllegalArgumentException> { input().copy(home = List(5) { team("h").first() }) }
        assertFailsWith<IllegalArgumentException> { input().copy(away = team("h")) }
        assertFailsWith<IllegalArgumentException> { input().copy(awayKeeperBase = 100) }
        assertFailsWith<IllegalArgumentException> { engine.simulate(input().copy(engineVersion = "1")) }
        assertFailsWith<IllegalArgumentException> { MatchStats(0, 1, 1, 1, 1, 1) }
    }
}
