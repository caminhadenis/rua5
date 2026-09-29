package com.streetfootball.game.recruitment

import com.streetfootball.game.match.domain.MatchOutcome
import org.junit.jupiter.api.Test
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

class RecruitmentPolicyTest {
    @Test
    fun `only a win against a recruitable player unlocks recruitment`() {
        for (outcome in MatchOutcome.entries) {
            for (recruitable in listOf(true, false)) {
                val expected = if (recruitable && outcome == MatchOutcome.WIN) RecruitmentStatus.AVAILABLE else RecruitmentStatus.LOCKED
                assertEquals(expected, RecruitmentPolicy.afterMatch(RecruitmentStatus.LOCKED, outcome, recruitable))
            }
        }
    }

    @Test
    fun `rematches preserve available and recruited states`() {
        for (status in listOf(RecruitmentStatus.AVAILABLE, RecruitmentStatus.RECRUITED)) {
            for (outcome in MatchOutcome.entries) {
                assertEquals(status, RecruitmentPolicy.afterMatch(status, outcome, true))
            }
        }
        RecruitmentPolicy.requireAvailable(RecruitmentStatus.AVAILABLE, true)
        assertFailsWith<RecruitmentNotAvailableException> { RecruitmentPolicy.requireAvailable(RecruitmentStatus.LOCKED, true) }
        assertFailsWith<RecruitmentNotAvailableException> { RecruitmentPolicy.requireAvailable(RecruitmentStatus.AVAILABLE, false) }
        assertFailsWith<RecruitmentNotAvailableException> { RecruitmentPolicy.requireAvailable(RecruitmentStatus.RECRUITED, true) }
    }
}
