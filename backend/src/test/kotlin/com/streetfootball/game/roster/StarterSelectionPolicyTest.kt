package com.streetfootball.game.roster

import org.junit.jupiter.api.Test
import org.junit.jupiter.api.assertThrows
import kotlin.test.assertEquals

class StarterSelectionPolicyTest {
    private val policy = StarterSelectionPolicy()

    @Test
    fun `grants a starter to a profile without one`() {
        assertEquals(
            StarterSelectionDecision.GRANT,
            policy.decide(starterSelected = false, requestedStarterAlreadyOwned = false),
        )
    }

    @Test
    fun `treats selecting the same starter again as already granted`() {
        assertEquals(
            StarterSelectionDecision.ALREADY_GRANTED,
            policy.decide(starterSelected = true, requestedStarterAlreadyOwned = true),
        )
    }

    @Test
    fun `rejects changing an already selected starter`() {
        assertThrows<StarterAlreadySelectedException> {
            policy.decide(starterSelected = true, requestedStarterAlreadyOwned = false)
        }
    }

    @Test
    fun `detects an owned starter without the profile flag`() {
        assertThrows<InconsistentStarterStateException> {
            policy.decide(starterSelected = false, requestedStarterAlreadyOwned = true)
        }
    }
}
