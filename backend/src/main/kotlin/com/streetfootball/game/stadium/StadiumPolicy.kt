package com.streetfootball.game.stadium

import com.streetfootball.game.match.domain.MatchParticipant

object StadiumPolicy {
    fun validate(
        completed: Boolean,
        accessible: Boolean,
        missingRequirements: Boolean,
    ) {
        if (completed) throw StadiumRuleException("STADIUM_ALREADY_COMPLETED")
        if (!accessible) throw StadiumRuleException("STADIUM_LOCKED")
        if (missingRequirements) throw StadiumRuleException("STADIUM_REQUIREMENT_NOT_MET")
    }

    const val REQUIRED_ROSTER_SIZE = 5

    fun validateRosterSize(count: Long) {
        if (count < REQUIRED_ROSTER_SIZE) throw StadiumRuleException("STADIUM_ROSTER_INCOMPLETE")
    }

    // Level first, then total effective attributes; stable IDs break equal-strength ties.
    fun orderedOpponents(players: List<MatchParticipant>): List<MatchParticipant> {
        if (players.size != 5) throw StadiumRuleException("STADIUM_LOCKED")
        return players.sortedWith(
            compareBy<MatchParticipant> { it.level }
                .thenBy {
                    it.stats.run { speed + dribbling + finishing + defending + physical }
                }.thenBy { it.playerDefinitionId },
        )
    }
}

class StadiumRuleException(
    val code: String,
) : RuntimeException(code)
