package com.streetfootball.game.match.domain

import java.util.Random
import kotlin.math.ceil

enum class MatchTempo { SLOW, NORMAL, FAST }

enum class MatchPosture { DEFENSIVE, BALANCED, OFFENSIVE }

data class CoachInstruction(
    val tempo: MatchTempo = MatchTempo.NORMAL,
    val posture: MatchPosture = MatchPosture.BALANCED,
)

data class CoachedDuelState(
    val step: Int = 0,
    val elapsedSeconds: Int = 0,
    val actionIndex: Int = 0,
    val possession: MatchSide,
    val homeEffort: Double = 0.0,
    val awayEffort: Double = 0.0,
    val instructions: List<CoachInstruction> = emptyList(),
    val events: List<MatchEvent> = emptyList(),
) {
    val finished: Boolean get() = step == CoachedDuelEngine.STEPS
}

/** Pure incremental engine. One independently seeded RNG per action makes persisted resumes exact. */
class CoachedDuelEngine : MatchEngine {
    fun start(request: MatchRequest): CoachedDuelState {
        require(request.engineVersion == VERSION && request.mode != MatchMode.STADIUM_5V5)
        require(request.homeInitialFatigue in 0.0..100.0 && request.awayInitialFatigue in 0.0..100.0)
        return CoachedDuelState(possession = if (Random(request.seed).nextBoolean()) MatchSide.HOME else MatchSide.AWAY)
    }

    fun advance(
        request: MatchRequest,
        previous: CoachedDuelState,
        instruction: CoachInstruction,
    ): CoachedDuelState {
        require(request.engineVersion == VERSION && !previous.finished)
        val events = previous.events.toMutableList()
        var elapsed = previous.elapsedSeconds
        var actionIndex = previous.actionIndex
        var side = previous.possession
        var homeEffort = previous.homeEffort
        var awayEffort = previous.awayEffort
        val boundary = (previous.step + 1) * SECONDS_PER_STEP
        val neutral = CoachInstruction()
        while (elapsed < boundary) {
            val random = Random(request.seed xor (++actionIndex * -7046029254386353131L))
            val attackingInstruction = if (side == MatchSide.HOME) instruction else neutral
            val defendingInstruction = if (side == MatchSide.HOME) neutral else instruction
            val duration =
                minOf(
                    boundary - elapsed,
                    when (attackingInstruction.tempo) {
                        MatchTempo.SLOW -> 100
                        MatchTempo.NORMAL -> 60
                        MatchTempo.FAST -> 40
                    },
                )
            val attacker = if (side == MatchSide.HOME) request.home.single() else request.away.single()
            val defender = if (side == MatchSide.HOME) request.away.single() else request.home.single()
            val h = effectiveStats(request.home.single().stats, request.homeInitialFatigue + homeEffort)
            val a = effectiveStats(request.away.single().stats, request.awayInitialFatigue + awayEffort)
            val attackStats = if (side == MatchSide.HOME) h else a
            val defenseStats = if (side == MatchSide.HOME) a else h
            elapsed += duration

            fun emit(
                type: MatchEventType,
                defending: Boolean = false,
                quality: String? = null,
            ) {
                events +=
                    MatchEvent(
                        events.size + 1,
                        ceil(elapsed / 60.0).toInt(),
                        type,
                        if (defending) side.opponent() else side,
                        if (defending) defender.playerId else attacker.playerId,
                        if (defending) attacker.playerId else defender.playerId,
                        if (quality == null) emptyMap() else mapOf("quality" to quality),
                    )
            }
            emit(MatchEventType.POSSESSION)
            val attack =
                .55 * attackStats.dribbling + .30 * attackStats.speed + .15 * attackStats.physical + attackingInstruction.attackBonus()
            val defense =
                .65 * defenseStats.defending + .25 * defenseStats.speed + .10 * defenseStats.physical + defendingInstruction.defenseBonus()
            val success = probability((attack - defense) / 18.0)
            val holds = attackingInstruction.tempo == MatchTempo.SLOW && random.nextDouble() < .4
            if (random.nextInt(10000) >= success) {
                emit(MatchEventType.TACKLE, defending = true)
                side = side.opponent()
            } else if (holds) {
                emit(MatchEventType.HOLD)
            } else {
                val freeChance =
                    (
                        .4 + (attackStats.speed - defenseStats.speed) / 150.0 +
                            when (attackingInstruction.tempo) {
                                MatchTempo.SLOW -> .12
                                MatchTempo.NORMAL -> 0.0
                                MatchTempo.FAST -> -.12
                            }
                    ).coerceIn(.15, .8)
                val free = random.nextDouble() < freeChance
                val quality = if (free) "FREE" else "PRESSURED"
                emit(MatchEventType.DRIBBLE_SUCCESS, quality = quality)
                emit(MatchEventType.SHOT, quality = quality)
                // Defense already determined pressure. Do not apply the marker's full stats a second time.
                val finish =
                    attackStats.finishing +
                        when (attackingInstruction.tempo) {
                            MatchTempo.FAST -> -3.0
                            MatchTempo.SLOW -> 2.0
                            MatchTempo.NORMAL -> 0.0
                        }
                val goal = random.nextInt(10000) < probability((finish - 50) / 30.0 + if (free) .65 else -.35)
                emit(
                    if (goal) {
                        MatchEventType.GOAL
                    } else if (!free &&
                        random.nextBoolean()
                    ) {
                        MatchEventType.SHOT_BLOCKED
                    } else {
                        MatchEventType.SHOT_MISSED
                    },
                    quality = quality,
                )
                side = side.opponent()
            }
            // Costs depend on actual action duration and intensity, for both attacker and defender.
            val homeAttacking = attacker.playerId == request.home.single().playerId
            homeEffort +=
                effort(
                    duration,
                    instruction.tempo,
                    request.home
                        .single()
                        .stats.physical,
                    homeAttacking,
                )
            awayEffort +=
                effort(
                    duration,
                    MatchTempo.NORMAL,
                    request.away
                        .single()
                        .stats.physical,
                    !homeAttacking,
                )
        }
        val next =
            CoachedDuelState(
                previous.step + 1,
                elapsed,
                actionIndex,
                side,
                homeEffort,
                awayEffort,
                previous.instructions + instruction,
                events,
            )
        return if (next.finished && request.mode == MatchMode.STADIUM_1V1) withPenalties(request, next) else next
    }

    fun result(
        request: MatchRequest,
        state: CoachedDuelState,
    ): MatchResult {
        require(state.finished)
        val stats = MatchStatistics(statistics(state.events, MatchSide.HOME), statistics(state.events, MatchSide.AWAY))
        val penalties =
            state.events
                .filter { it.type == MatchEventType.PENALTY_GOAL || it.type == MatchEventType.PENALTY_MISSED }
                .takeIf { it.isNotEmpty() }
                ?.let {
                    PenaltyScore(
                        it.count { e ->
                            e.side == MatchSide.HOME &&
                                e.type == MatchEventType.PENALTY_GOAL
                        },
                        it.count { e -> e.side == MatchSide.AWAY && e.type == MatchEventType.PENALTY_GOAL },
                    )
                }
        val difference = penalties?.let { it.home - it.away } ?: (stats.home.goals - stats.away.goals)
        return MatchResult(
            stats.home.goals,
            stats.away.goals,
            when {
                difference > 0 -> MatchOutcome.WIN
                difference < 0 -> MatchOutcome.LOSS
                else -> MatchOutcome.DRAW
            },
            state.events,
            stats,
            request.seed,
            VERSION,
            penalties,
        )
    }

    override fun simulate(request: MatchRequest): MatchResult {
        require(request.coaching.isEmpty() || request.coaching.size == STEPS)
        var state = start(request)
        repeat(STEPS) { state = advance(request, state, request.coaching.getOrElse(it) { CoachInstruction() }) }
        return result(request, state)
    }

    private fun withPenalties(
        request: MatchRequest,
        state: CoachedDuelState,
    ): CoachedDuelState {
        if (statistics(state.events, MatchSide.HOME).goals != statistics(state.events, MatchSide.AWAY).goals) return state
        val random = Random(request.seed xor 0x434f414348L)
        val events = state.events.toMutableList()
        val home = effectiveStats(request.home.single().stats, request.homeInitialFatigue + state.homeEffort)
        val away = effectiveStats(request.away.single().stats, request.awayInitialFatigue + state.awayEffort)
        var h = 0
        var a = 0
        var round = 0
        do {
            val hg =
                if (round ==
                    25
                ) {
                    random.nextInt(10000) < probability((home.finishing - away.finishing) / 30)
                } else {
                    random.nextInt(10000) <
                        probability(.65 + (home.finishing - 50) / 30)
                }
            val ag = if (round == 25) !hg else random.nextInt(10000) < probability(.65 + (away.finishing - 50) / 30)
            if (hg) h++
            events +=
                MatchEvent(
                    events.size + 1,
                    21 + round,
                    if (hg) MatchEventType.PENALTY_GOAL else MatchEventType.PENALTY_MISSED,
                    MatchSide.HOME,
                    request.home.single().playerId,
                    metadata =
                        mapOf(
                            "homePenalties" to h.toString(),
                            "awayPenalties" to a.toString(),
                        ),
                )
            if (ag) a++
            events +=
                MatchEvent(
                    events.size + 1,
                    21 + round,
                    if (ag) MatchEventType.PENALTY_GOAL else MatchEventType.PENALTY_MISSED,
                    MatchSide.AWAY,
                    request.away.single().playerId,
                    metadata =
                        mapOf(
                            "homePenalties" to h.toString(),
                            "awayPenalties" to a.toString(),
                        ),
                )
            round++
        } while (round < 5 || h == a)
        return state.copy(events = events)
    }

    private fun CoachInstruction.attackBonus() =
        when (posture) {
            MatchPosture.OFFENSIVE -> 6.0
            MatchPosture.DEFENSIVE -> -6.0
            MatchPosture.BALANCED -> 0.0
        }

    private fun CoachInstruction.defenseBonus() = -attackBonus()

    private fun probability(value: Double): Int = (10000 / (1 + StrictMath.exp(-value))).toInt().coerceIn(1000, 9000)

    private fun effort(
        seconds: Int,
        tempo: MatchTempo,
        physical: Double,
        attacking: Boolean,
    ): Double =
        seconds / 60.0 *
            (if (attacking) 1.0 else .8) * (1.15 - physical * .003) *
            when (tempo) {
                MatchTempo.FAST -> 1.55
                MatchTempo.NORMAL -> 1.0
                MatchTempo.SLOW -> .65
            }

    companion object {
        const val VERSION = "4"
        const val STEPS = 5
        const val SECONDS_PER_STEP = 240

        fun effectiveStats(
            stats: MatchStats,
            fatigue: Double,
        ): MatchStats {
            val value = fatigue.coerceIn(0.0, 100.0) / 100

            fun reduce(
                stat: Double,
                penalty: Double,
            ) = (stat * (1 - value * penalty)).coerceIn(1.0, 99.0)
            return MatchStats(
                reduce(stats.speed, .18),
                reduce(stats.dribbling, .12),
                reduce(stats.finishing, .08),
                reduce(stats.defending, .12),
                reduce(stats.physical, .10),
            )
        }
    }
}
