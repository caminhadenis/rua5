package com.streetfootball.game.roster

import org.junit.jupiter.api.Test
import kotlin.test.assertFailsWith

class RosterPolicyTest {
    @Test
    fun `only rosters with fewer than five have a vacancy`() {
        for (count in 0L..4L) RosterPolicy.requireVacancy(count)
        for (count in listOf(5L, 6L, 100L)) assertFailsWith<RosterFullException> { RosterPolicy.requireVacancy(count) }
    }
}
