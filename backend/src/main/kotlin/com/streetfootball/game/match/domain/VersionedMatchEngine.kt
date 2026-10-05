package com.streetfootball.game.match.domain

class VersionedMatchEngine : MatchEngine {
    override fun simulate(request: MatchRequest): MatchResult =
        when (request.mode) {
            MatchMode.DUEL_1V1 -> DuelMatchEngine().simulate(request)
            MatchMode.STADIUM_1V1 -> StadiumDuelEngine().simulate(request)
            MatchMode.STADIUM_5V5 -> throw IllegalArgumentException("Historical matches cannot be simulated.")
        }
}
