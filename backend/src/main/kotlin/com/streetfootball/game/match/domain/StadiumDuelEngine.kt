package com.streetfootball.game.match.domain

import java.util.Random

/** Stadium duels reuse version 1 regulation and resolve draws with paired penalties. */
class StadiumDuelEngine : MatchEngine {
    override fun simulate(request: MatchRequest): MatchResult {
        require(request.mode == MatchMode.STADIUM_1V1 && request.engineVersion == VERSION)
        val result = DuelMatchEngine().simulate(request.copy(mode = MatchMode.DUEL_1V1, engineVersion = DuelMatchEngine.VERSION))
        if (result.outcome != MatchOutcome.DRAW) return result.copy(engineVersion = VERSION)
        val random = Random(request.seed xor 0x5354414449554dL)
        val events = result.events.toMutableList()
        val homePlayer = request.home.single()
        val awayPlayer = request.away.single()
        var home = 0
        var away = 0
        var round = 0
        while (round < 5 || home == away) {
            val h: Boolean
            val a: Boolean
            if (round == 25) {
                h = random.nextInt(10000) < chance(homePlayer.stats.finishing * 100, awayPlayer.stats.finishing * 100)
                a = !h
            } else {
                h = random.nextInt(10000) < chance(homePlayer.stats.finishing * 100 + 3000, awayPlayer.stats.defending * 100)
                a = random.nextInt(10000) < chance(awayPlayer.stats.finishing * 100 + 3000, homePlayer.stats.defending * 100)
            }
            if (h) home++
            events +=
                MatchEvent(
                    events.size + 1,
                    21 + round,
                    if (h) MatchEventType.PENALTY_GOAL else MatchEventType.PENALTY_MISSED,
                    MatchSide.HOME,
                    homePlayer.playerId,
                    metadata = mapOf("homePenalties" to home.toString(), "awayPenalties" to away.toString()),
                )
            if (a) away++
            events +=
                MatchEvent(
                    events.size + 1,
                    21 + round,
                    if (a) MatchEventType.PENALTY_GOAL else MatchEventType.PENALTY_MISSED,
                    MatchSide.AWAY,
                    awayPlayer.playerId,
                    metadata = mapOf("homePenalties" to home.toString(), "awayPenalties" to away.toString()),
                )
            round++
        }
        return result.copy(
            outcome = if (home > away) MatchOutcome.WIN else MatchOutcome.LOSS,
            events = events,
            engineVersion = VERSION,
            penalties = PenaltyScore(home, away),
        )
    }

    companion object {
        const val VERSION = "3"
    }
}
