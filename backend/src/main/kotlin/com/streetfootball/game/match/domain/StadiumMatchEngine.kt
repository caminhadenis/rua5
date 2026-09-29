package com.streetfootball.game.match.domain

import java.util.Random

/** Abstract zones, collective defense and no goalkeeper participant or real-time physics. */
class StadiumMatchEngine : MatchEngine {
    override fun simulate(request: MatchRequest): MatchResult {
        require(request.mode == MatchMode.STADIUM_5V5 && request.engineVersion == VERSION)
        val random = Random(request.seed)
        val events = mutableListOf<MatchEvent>()

        fun team(side: MatchSide) = if (side == MatchSide.HOME) request.home else request.away

        fun keeper(side: MatchSide): Int {
            val contribution = team(side).sumOf { it.stats.defending + it.stats.physical } / 20
            return ((if (side == MatchSide.HOME) 35 else request.awayKeeperBase) + contribution).coerceIn(1, 99)
        }

        fun pick(
            players: List<MatchParticipant>,
            weight: (MatchStats) -> Int,
        ): MatchParticipant {
            var ticket = random.nextInt(players.sumOf { weight(it.stats) })
            return players.first {
                ticket -= weight(it.stats)
                ticket < 0
            }
        }

        fun emit(
            type: MatchEventType,
            side: MatchSide,
            actor: MatchParticipant,
            minute: Int,
            target: MatchParticipant? = null,
            metadata: Map<String, String> = emptyMap(),
        ) {
            events += MatchEvent(events.size + 1, minute, type, side, actor.playerId, target?.playerId, metadata)
        }
        val first = if (random.nextBoolean()) MatchSide.HOME else MatchSide.AWAY
        repeat(30) { index ->
            val side = if (index % 2 == 0) first else first.opponent()
            val minute = index + 1
            val builder = pick(team(side)) { it.passing + it.dribbling }
            val defender = pick(team(side.opponent())) { it.defending + it.physical }
            emit(MatchEventType.POSSESSION, side, builder, minute, metadata = mapOf("zone" to "BUILD_UP"))
            val pass = random.nextBoolean()
            val attack =
                builder.stats.let {
                    if (pass) {
                        70 * it.passing + 30 * it.dribbling
                    } else {
                        55 * it.dribbling + 25 * it.speed +
                            20 * it.physical
                    }
                }
            val defense = defender.stats.let { 60 * it.defending + 20 * it.speed + 20 * it.physical }
            if (random.nextInt(10000) >= chance(attack, defense)) {
                emit(MatchEventType.TACKLE, side.opponent(), defender, minute, builder)
            } else {
                val finisher = pick(if (pass) team(side).filter { it != builder } else team(side)) { it.finishing + it.speed }
                emit(
                    if (pass) MatchEventType.PASS else MatchEventType.DRIBBLE_SUCCESS,
                    side,
                    builder,
                    minute,
                    if (pass) finisher else defender,
                    mapOf("zone" to "ATTACK"),
                )
                emit(MatchEventType.SHOT, side, finisher, minute)
                val finishing = finisher.stats.let { 80 * it.finishing + 20 * it.physical }
                if (random.nextInt(10000) < chance(finishing, keeper(side.opponent()) * 100)) {
                    emit(MatchEventType.GOAL, side, finisher, minute)
                } else {
                    // Actor remains the shooter: there is no invented sixth player in the timeline.
                    emit(if (random.nextBoolean()) MatchEventType.SAVE else MatchEventType.SHOT_MISSED, side, finisher, minute)
                }
            }
        }
        val stats = MatchStatistics(statistics(events, MatchSide.HOME), statistics(events, MatchSide.AWAY))
        var penalties: PenaltyScore? = null
        if (stats.home.goals == stats.away.goals) {
            var home = 0
            var away = 0
            var round = 0
            // Five paired kicks, then sudden death. A bounded paired contest ensures termination.
            while (round < 5 || home == away) {
                val homeTaker = request.home[round % 5]
                val awayTaker = request.away[round % 5]
                val h: Boolean
                val a: Boolean
                if (round == 25) {
                    h = random.nextInt(10000) < chance(homeTaker.stats.finishing * 100, awayTaker.stats.finishing * 100)
                    a = !h
                } else {
                    h = random.nextInt(10000) < chance(homeTaker.stats.finishing * 100 + 3000, keeper(MatchSide.AWAY) * 100)
                    a = random.nextInt(10000) < chance(awayTaker.stats.finishing * 100 + 3000, keeper(MatchSide.HOME) * 100)
                }
                if (h) home++
                if (a) away++
                emit(
                    if (h) MatchEventType.PENALTY_GOAL else MatchEventType.PENALTY_MISSED,
                    MatchSide.HOME,
                    homeTaker,
                    31 + round,
                    metadata = mapOf("homePenalties" to home.toString(), "awayPenalties" to (away - if (a) 1 else 0).toString()),
                )
                emit(
                    if (a) MatchEventType.PENALTY_GOAL else MatchEventType.PENALTY_MISSED,
                    MatchSide.AWAY,
                    awayTaker,
                    31 + round,
                    metadata = mapOf("homePenalties" to home.toString(), "awayPenalties" to away.toString()),
                )
                round++
            }
            penalties = PenaltyScore(home, away)
        }
        val won = penalties?.let { it.home > it.away } ?: (stats.home.goals > stats.away.goals)
        return MatchResult(
            stats.home.goals,
            stats.away.goals,
            if (won) MatchOutcome.WIN else MatchOutcome.LOSS,
            events.toList(),
            stats,
            request.seed,
            VERSION,
            penalties,
        )
    }

    companion object {
        const val VERSION = "2"
    }
}

class VersionedMatchEngine : MatchEngine {
    override fun simulate(request: MatchRequest): MatchResult =
        when (request.mode) {
            MatchMode.DUEL_1V1 -> DuelMatchEngine().simulate(request)
            MatchMode.STADIUM_5V5 -> StadiumMatchEngine().simulate(request)
        }
}
