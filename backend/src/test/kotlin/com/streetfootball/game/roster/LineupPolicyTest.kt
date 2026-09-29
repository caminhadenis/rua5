package com.streetfootball.game.roster

import com.streetfootball.game.challenge.PlayerNotOwnedException
import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertFailsWith

class LineupPolicyTest {
    private val ids = List(6) { UUID.randomUUID() }

    @Test
    fun `five slots may be empty partial or full and roster may contain reserves`() {
        LineupPolicy.validate(List(5) { null }, ids.toSet())
        LineupPolicy.validate(listOf(ids[0], null, ids[2], null, null), ids.toSet())
        LineupPolicy.validate(ids.take(5), ids.toSet())
    }

    @Test
    fun `invalid size duplicates and foreign players are rejected`() {
        assertFailsWith<InvalidLineupException> { LineupPolicy.validate(ids.take(4), ids.toSet()) }
        assertFailsWith<InvalidLineupException> { LineupPolicy.validate(ids, ids.toSet()) }
        assertFailsWith<InvalidLineupException> { LineupPolicy.validate(List(5) { ids[0] }, ids.toSet()) }
        assertFailsWith<PlayerNotOwnedException> { LineupPolicy.validate(ids.take(5), ids.drop(1).toSet()) }
    }
}
