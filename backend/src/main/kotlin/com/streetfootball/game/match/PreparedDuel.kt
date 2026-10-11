package com.streetfootball.game.match

import com.streetfootball.game.match.domain.MatchRequest
import java.util.UUID

/** Server-only snapshot, validated under the profile lock before starting a simulation. */
data class PreparedDuel(
    val profileId: UUID,
    val ownedPlayerId: UUID,
    val request: MatchRequest,
    val homeFatigue: Double,
    val awayFatigue: Double,
    val sourceId: UUID? = null,
    val stadiumId: String? = null,
    val seriesId: UUID? = null,
    val roundNumber: Int? = null,
    val expectedSeriesId: UUID? = null,
)
