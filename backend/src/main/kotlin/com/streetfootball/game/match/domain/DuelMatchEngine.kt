package com.streetfootball.game.match.domain

import java.util.Random

/** Version 1 uses java.util.Random's specified algorithm and integer probability thresholds.
 * Every simulation owns its RNG and event buffer; no framework, clock or shared mutable state.
 */
class DuelMatchEngine : MatchEngine {
    override fun simulate(request: MatchRequest): MatchResult {
        require(request.mode == MatchMode.DUEL_1V1)
        require(request.engineVersion == VERSION) { "Unsupported engine version: ${request.engineVersion}" }
        val random = Random(request.seed)
        val events = mutableListOf<MatchEvent>()
        val firstSide = if (random.nextBoolean()) MatchSide.HOME else MatchSide.AWAY

        // Equal opportunities: ten possessions each, with a seeded starting side. Draws stand.
        repeat(POSSESSIONS) { index ->
            val side = if (index % 2 == 0) firstSide else firstSide.opponent()
            val attacker = if (side == MatchSide.HOME) request.home.single() else request.away.single()
            val defender = if (side == MatchSide.HOME) request.away.single() else request.home.single()

            fun emit(
                type: MatchEventType,
                defending: Boolean = false,
                targeted: Boolean = false,
            ) {
                events +=
                    MatchEvent(
                        sequence = events.size + 1,
                        minute = index + 1,
                        type = type,
                        side = if (defending) side.opponent() else side,
                        actorPlayerId = if (defending) defender.playerId else attacker.playerId,
                        targetPlayerId = if (targeted) (if (defending) attacker.playerId else defender.playerId) else null,
                    )
            }

            emit(MatchEventType.POSSESSION)
            val attack = attacker.stats.let { 55 * it.dribbling + 25 * it.speed + 20 * it.physical }
            val defense = defender.stats.let { 60 * it.defending + 20 * it.speed + 20 * it.physical }
            if (random.nextInt(10000) < chance(attack, defense)) {
                emit(MatchEventType.DRIBBLE_SUCCESS, targeted = true)
                emit(MatchEventType.SHOT)
                val finishing = attacker.stats.let { 80 * it.finishing + 20 * it.physical }
                val resistance = defender.stats.let { 70 * it.defending + 30 * it.physical }
                emit(if (random.nextInt(10000) < chance(finishing, resistance)) MatchEventType.GOAL else MatchEventType.SHOT_MISSED)
            } else {
                emit(MatchEventType.TACKLE, defending = true, targeted = true)
            }
        }

        val statistics = MatchStatistics(statistics(events, MatchSide.HOME), statistics(events, MatchSide.AWAY))
        val homeScore = statistics.home.goals
        val awayScore = statistics.away.goals
        return MatchResult(
            homeScore = homeScore,
            awayScore = awayScore,
            outcome =
                when {
                    homeScore > awayScore -> MatchOutcome.WIN
                    homeScore < awayScore -> MatchOutcome.LOSS
                    else -> MatchOutcome.DRAW
                },
            events = events.toList(),
            statistics = statistics,
            seed = request.seed,
            engineVersion = VERSION,
        )
    }

    companion object {
        const val VERSION = "1"
        const val POSSESSIONS = 20
    }
}
