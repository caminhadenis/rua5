package com.streetfootball.game.match.domain

interface MatchEngine {
    fun simulate(request: MatchRequest): MatchResult
}

enum class MatchMode { DUEL_1V1, STADIUM_1V1, STADIUM_5V5 }

enum class MatchSide { HOME, AWAY }

enum class MatchOutcome { WIN, DRAW, LOSS }

enum class MatchEventType { POSSESSION, DRIBBLE_SUCCESS, TACKLE, SHOT, SHOT_MISSED, GOAL, SAVE, PENALTY_GOAL, PENALTY_MISSED }

data class MatchStats(
    val speed: Double,
    val dribbling: Double,
    val finishing: Double,
    val defending: Double,
    val physical: Double,
) {
    constructor(speed: Int, dribbling: Int, finishing: Int, defending: Int, physical: Int) :
        this(speed.toDouble(), dribbling.toDouble(), finishing.toDouble(), defending.toDouble(), physical.toDouble())

    init {
        require(listOf(speed, dribbling, finishing, defending, physical).all { it in 1.0..99.0 }) {
            "All stats must be within 1..99."
        }
    }
}

data class MatchParticipant(
    val playerId: String,
    val playerDefinitionId: String,
    val name: String,
    val level: Int,
    val stats: MatchStats,
) {
    init {
        require(playerId.isNotBlank() && playerDefinitionId.isNotBlank() && name.isNotBlank())
        require(level in 1..15)
    }
}

data class MatchRequest(
    val mode: MatchMode,
    val home: List<MatchParticipant>,
    val away: List<MatchParticipant>,
    val seed: Long,
    val engineVersion: String,
    val awayKeeperBase: Int = 35,
) {
    init {
        val size = if (mode == MatchMode.STADIUM_5V5) 5 else 1
        require(home.size == size && away.size == size) { "Invalid participant count for $mode." }
        require((home + away).map { it.playerId }.distinct().size == size * 2) { "Participant IDs must be distinct." }
        require(awayKeeperBase in 1..99)
    }
}

data class MatchEvent(
    val sequence: Int,
    val minute: Int,
    val type: MatchEventType,
    val side: MatchSide,
    val actorPlayerId: String,
    val targetPlayerId: String? = null,
    val metadata: Map<String, String> = emptyMap(),
)

data class SideStatistics(
    val possessions: Int,
    val successfulDribbles: Int,
    val tackles: Int,
    val shots: Int,
    val goals: Int,
)

data class MatchStatistics(
    val home: SideStatistics,
    val away: SideStatistics,
)

data class MatchResult(
    val homeScore: Int,
    val awayScore: Int,
    val outcome: MatchOutcome,
    val events: List<MatchEvent>,
    val statistics: MatchStatistics,
    val seed: Long,
    val engineVersion: String,
    val penalties: PenaltyScore? = null,
)

data class PenaltyScore(
    val home: Int,
    val away: Int,
)
