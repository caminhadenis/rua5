package com.streetfootball.game.recruitment

import com.streetfootball.game.match.domain.MatchOutcome

enum class RecruitmentStatus { LOCKED, AVAILABLE, RECRUITED }

/** Only an authoritative, eligible win can unlock; subsequent outcomes never revoke it. */
object RecruitmentPolicy {
    fun afterMatch(
        status: RecruitmentStatus,
        outcome: MatchOutcome,
        recruitable: Boolean,
    ): RecruitmentStatus =
        if (status == RecruitmentStatus.LOCKED && recruitable && outcome == MatchOutcome.WIN) RecruitmentStatus.AVAILABLE else status

    fun requireAvailable(
        status: RecruitmentStatus,
        recruitable: Boolean,
    ) {
        if (status != RecruitmentStatus.AVAILABLE || !recruitable) throw RecruitmentNotAvailableException()
    }
}

class RecruitmentNotAvailableException : RuntimeException("Recruitment is not available.")
