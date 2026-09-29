package com.streetfootball.game.stadium

import org.junit.jupiter.api.Test
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class StadiumPolicyTest {
    @Test
    fun `five distinct slots requirements access and permanent completion are mandatory`() {
        val full = List(5) { UUID.randomUUID() }
        StadiumPolicy.validate(false, true, false, full)

        fun rejected(
            code: String,
            completed: Boolean = false,
            access: Boolean = true,
            missing: Boolean = false,
            slots: List<UUID?> = full,
        ) {
            assertEquals(code, assertFailsWith<StadiumRuleException> { StadiumPolicy.validate(completed, access, missing, slots) }.code)
        }
        rejected("STADIUM_ALREADY_COMPLETED", completed = true)
        rejected("STADIUM_LOCKED", access = false)
        rejected("STADIUM_REQUIREMENT_NOT_MET", missing = true)
        rejected("LINEUP_INCOMPLETE", slots = full.take(4))
        rejected("LINEUP_INCOMPLETE", slots = full.take(4) + null)
        rejected("LINEUP_INCOMPLETE", slots = List(5) { full.first() })
    }
}
