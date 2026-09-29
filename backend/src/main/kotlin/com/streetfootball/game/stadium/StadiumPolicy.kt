package com.streetfootball.game.stadium

import java.util.UUID

object StadiumPolicy {
    fun validate(
        completed: Boolean,
        accessible: Boolean,
        missingRequirements: Boolean,
        lineup: List<UUID?>,
    ) {
        if (completed) throw StadiumRuleException("STADIUM_ALREADY_COMPLETED")
        if (!accessible) throw StadiumRuleException("STADIUM_LOCKED")
        if (missingRequirements) throw StadiumRuleException("STADIUM_REQUIREMENT_NOT_MET")
        if (lineup.size != 5 || lineup.any { it == null } || lineup.distinct().size != 5) {
            throw StadiumRuleException("LINEUP_INCOMPLETE")
        }
    }
}

class StadiumRuleException(
    val code: String,
) : RuntimeException(code)
