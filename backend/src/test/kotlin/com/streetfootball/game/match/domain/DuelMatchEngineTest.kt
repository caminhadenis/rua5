package com.streetfootball.game.match.domain

import org.junit.jupiter.api.Test
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

class DuelMatchEngineTest {
    private val engine = DuelMatchEngine()

    @Test
    fun `quarter points affect probability without changing integer thresholds`() {
        for (difference in -10000..10000) {
            assertEquals((5000 + difference / 2).coerceIn(1000, 9000), chance(10000 + difference, 10000))
        }
        assertTrue(chance(55 * 50.25 + 25 * 50 + 20 * 50, 5000) > chance(5000, 5000))
        assertTrue(chance(5000, 60 * 50.25 + 20 * 50 + 20 * 50) < chance(5000, 5000))
        val input =
            request(42).let {
                it.copy(
                    home =
                        listOf(
                            it.home.single().copy(
                                stats =
                                    it.home
                                        .single()
                                        .stats
                                        .copy(dribbling = 50.25),
                            ),
                        ),
                )
            }
        assertEquals(engine.simulate(input), DuelMatchEngine().simulate(input))
    }

    @Test
    fun `version one retains its historical seed 42 fixture`() {
        val result = engine.simulate(request(42))
        val signature =
            result.events.groupBy { it.minute }.entries.joinToString("\n") { (minute, events) ->
                "$minute:${events.first().side}:${events.joinToString(",") { it.type.name }}"
            }
        assertEquals(
            """
            1:HOME:POSSESSION,DRIBBLE_SUCCESS,SHOT,GOAL
            2:AWAY:POSSESSION,TACKLE
            3:HOME:POSSESSION,TACKLE
            4:AWAY:POSSESSION,TACKLE
            5:HOME:POSSESSION,DRIBBLE_SUCCESS,SHOT,SHOT_MISSED
            6:AWAY:POSSESSION,TACKLE
            7:HOME:POSSESSION,TACKLE
            8:AWAY:POSSESSION,TACKLE
            9:HOME:POSSESSION,TACKLE
            10:AWAY:POSSESSION,TACKLE
            11:HOME:POSSESSION,DRIBBLE_SUCCESS,SHOT,GOAL
            12:AWAY:POSSESSION,TACKLE
            13:HOME:POSSESSION,TACKLE
            14:AWAY:POSSESSION,TACKLE
            15:HOME:POSSESSION,TACKLE
            16:AWAY:POSSESSION,DRIBBLE_SUCCESS,SHOT,GOAL
            17:HOME:POSSESSION,TACKLE
            18:AWAY:POSSESSION,TACKLE
            19:HOME:POSSESSION,DRIBBLE_SUCCESS,SHOT,GOAL
            20:AWAY:POSSESSION,TACKLE
            """.trimIndent(),
            signature,
        )
        assertEquals(3, result.homeScore)
        assertEquals(1, result.awayScore)
        assertEquals(MatchOutcome.WIN, result.outcome)
        assertEquals(MatchStatistics(SideStatistics(10, 4, 9, 4, 3), SideStatistics(10, 1, 6, 1, 1)), result.statistics)
    }

    @Test
    fun `same complete input reproduces every event and statistic across instances and calls`() {
        for (seed in (0L..1000L) + listOf(Long.MIN_VALUE, Long.MAX_VALUE, -1L)) {
            val request = request(seed)
            val expected = engine.simulate(request)
            engine.simulate(request(seed + 1))
            assertEquals(expected, engine.simulate(request))
            assertEquals(expected, DuelMatchEngine().simulate(request.copy()))
        }
        assertTrue((0L..50L).map { engine.simulate(request(it)).events }.distinct().size > 40)
    }

    @Test
    fun `concurrent simulations cannot interfere with one another`() {
        Executors.newFixedThreadPool(8).use { executor ->
            val requests = (0L..200L).map(::request)
            val expected = requests.map(engine::simulate)
            val actual = executor.invokeAll(requests.map { Callable { engine.simulate(it) } }).map { it.get() }
            assertEquals(expected, actual)
        }
    }

    @Test
    fun `thousands of seeds and boundary stats respect scores events and possession causality`() {
        for (stats in listOf(1 to 1, 99 to 99, 1 to 99, 99 to 1, 50 to 50)) {
            for (seed in 0L..999L) {
                val request = request(seed, stats.first, stats.second)
                val result = engine.simulate(request)
                assertEquals(seed, result.seed)
                assertEquals("1", result.engineVersion)
                assertEquals((1..result.events.size).toList(), result.events.map { it.sequence })
                assertEquals(result.events.map { it.minute }.sorted(), result.events.map { it.minute })
                assertTrue(result.events.size <= 80)
                assertTrue(result.homeScore in 0..10 && result.awayScore in 0..10)
                for (side in MatchSide.entries) {
                    val participant = if (side == MatchSide.HOME) request.home.single() else request.away.single()
                    val opponent = if (side == MatchSide.HOME) request.away.single() else request.home.single()
                    val events = result.events.filter { it.side == side }
                    assertTrue(events.all { it.actorPlayerId == participant.playerId })
                    assertTrue(events.all { it.targetPlayerId == null || it.targetPlayerId == opponent.playerId })
                    val goals = events.count { it.type == MatchEventType.GOAL }
                    assertEquals(goals, if (side == MatchSide.HOME) result.homeScore else result.awayScore)
                    val statistics = if (side == MatchSide.HOME) result.statistics.home else result.statistics.away
                    assertEquals(10, statistics.possessions)
                    assertEquals(goals, statistics.goals)
                    assertEquals(events.count { it.type == MatchEventType.SHOT }, statistics.shots)
                    assertEquals(events.count { it.type == MatchEventType.TACKLE }, statistics.tackles)
                    assertEquals(events.count { it.type == MatchEventType.DRIBBLE_SUCCESS }, statistics.successfulDribbles)
                    assertEquals(statistics.shots, goals + events.count { it.type == MatchEventType.SHOT_MISSED })
                }
                for (possession in result.events.groupBy { it.minute }.values) {
                    assertEquals(MatchEventType.POSSESSION, possession.first().type)
                    if (possession.size == 2) {
                        assertEquals(MatchEventType.TACKLE, possession.last().type)
                        assertTrue(possession.first().side != possession.last().side)
                    } else {
                        assertEquals(4, possession.size)
                        assertEquals(MatchEventType.DRIBBLE_SUCCESS, possession[1].type)
                        assertEquals(MatchEventType.SHOT, possession[2].type)
                        assertTrue(possession.last().type in listOf(MatchEventType.GOAL, MatchEventType.SHOT_MISSED))
                        assertEquals(1, possession.map { it.side }.distinct().size)
                    }
                }
                assertEquals(
                    when {
                        result.homeScore > result.awayScore -> MatchOutcome.WIN
                        result.homeScore < result.awayScore -> MatchOutcome.LOSS
                        else -> MatchOutcome.DRAW
                    },
                    result.outcome,
                )
            }
        }
    }

    @Test
    fun `duels allow draws and have no tiebreaker`() {
        val results = (0L..300L).map { engine.simulate(request(it)) }
        assertEquals(MatchOutcome.entries.toSet(), results.map { it.outcome }.toSet())
        assertTrue(results.filter { it.outcome == MatchOutcome.DRAW }.all { it.homeScore == it.awayScore && it.events.last().minute == 20 })
    }

    @Test
    fun `equal players are symmetric and stronger stats improve chances without guaranteeing a win`() {
        val equal = (0L..4999L).map { engine.simulate(request(it)) }
        val wins = equal.count { it.outcome == MatchOutcome.WIN }
        val losses = equal.count { it.outcome == MatchOutcome.LOSS }
        assertTrue(wins.toDouble() / (wins + losses) in 0.46..0.54)
        val stronger = (0L..1999L).map { engine.simulate(request(it, 60, 50)) }
        assertTrue(stronger.count { it.outcome == MatchOutcome.WIN } > stronger.count { it.outcome == MatchOutcome.LOSS })
        assertTrue(stronger.any { it.outcome == MatchOutcome.LOSS })
    }

    @Test
    fun `unsupported versions and invalid inputs fail explicitly`() {
        assertFailsWith<IllegalArgumentException> { engine.simulate(request(1).copy(engineVersion = "2")) }
        assertFailsWith<IllegalArgumentException> { request(1).copy(home = emptyList()) }
        assertFailsWith<IllegalArgumentException> { request(1).copy(home = request(1).home + request(1).home) }
        assertFailsWith<IllegalArgumentException> { request(1).copy(away = request(1).home) }
        assertFailsWith<IllegalArgumentException> { request(1).home.single().copy(level = 0) }
        for (invalid in listOf(0, 100, Int.MIN_VALUE, Int.MAX_VALUE)) {
            for (index in 0..4) {
                val stats = MutableList(5) { 50 }.also { it[index] = invalid }
                assertFailsWith<IllegalArgumentException> { MatchStats(stats[0], stats[1], stats[2], stats[3], stats[4]) }
            }
        }
    }

    private fun request(
        seed: Long,
        homeStat: Int = 50,
        awayStat: Int = 50,
    ) = MatchRequest(
        mode = MatchMode.DUEL_1V1,
        home = listOf(participant("home", homeStat)),
        away = listOf(participant("away", awayStat)),
        seed = seed,
        engineVersion = "1",
    )

    private fun participant(
        id: String,
        stat: Int,
    ) = MatchParticipant(
        playerId = id,
        playerDefinitionId = "definition_$id",
        name = id,
        level = 1,
        stats = MatchStats(stat, stat, stat, stat, stat),
    )
}
