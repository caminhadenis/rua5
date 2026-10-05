package com.streetfootball.game.stadium

import com.streetfootball.game.match.domain.MatchParticipant
import com.streetfootball.game.match.domain.MatchStats
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class StadiumPolicyTest {
    @Test
    fun `access requirements and permanent completion are mandatory without lineup requirements`() {
        StadiumPolicy.validate(false, true, false)
        for ((code, flags) in listOf(
            "STADIUM_ALREADY_COMPLETED" to listOf(true, true, false),
            "STADIUM_LOCKED" to listOf(false, false, false),
            "STADIUM_REQUIREMENT_NOT_MET" to listOf(false, true, true),
        )) {
            assertEquals(
                code,
                assertFailsWith<StadiumRuleException> {
                    StadiumPolicy.validate(flags[0], flags[1], flags[2])
                }.code,
            )
        }
    }

    @Test
    fun `five opponents ordered by effective strength leave the best for last with stable ties`() {
        fun player(
            id: String,
            level: Int,
            stat: Int,
        ) = MatchParticipant(id, id, id, level, MatchStats(stat, stat, stat, stat, stat))
        val players =
            listOf(
                player("b", 6, 40),
                player("a", 6, 40),
                player("best", 7, 50),
                player("weak", 1, 80),
                player("strong", 6, 70),
            )
        val sorted = StadiumPolicy.orderedOpponents(players)
        assertEquals(listOf("weak", "a", "b", "strong", "best"), sorted.map { it.playerId })
        assertEquals(sorted, StadiumPolicy.orderedOpponents(players.reversed()))
        assertFailsWith<StadiumRuleException> { StadiumPolicy.orderedOpponents(players.take(4)) }
    }
}
