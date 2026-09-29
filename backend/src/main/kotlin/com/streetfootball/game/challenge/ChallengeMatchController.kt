package com.streetfootball.game.challenge

import com.streetfootball.game.match.StoredMatch
import com.streetfootball.game.match.domain.MatchMode
import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchParticipant
import com.streetfootball.game.match.domain.MatchStatistics
import com.streetfootball.game.profile.ProfileSession
import com.streetfootball.game.progression.DuelRewards
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

@RestController
class ChallengeMatchController(
    private val service: ChallengeMatchService,
    private val session: ProfileSession,
) {
    @PostMapping("/api/v1/challenges/{challengerId}/matches")
    fun play(
        @PathVariable challengerId: UUID,
        @RequestHeader("Idempotency-Key") key: UUID,
        @RequestBody body: CreateDuelRequest,
        request: HttpServletRequest,
    ): DuelResponse {
        val stored = service.play(session.requireProfileId(request), challengerId, body.ownedPlayerId, key)
        return DuelResponse(stored.toResponse(), stored.rewards)
    }
}

data class CreateDuelRequest(
    val ownedPlayerId: UUID,
)

data class DuelResponse(
    val match: DuelMatchResponse,
    val rewards: DuelRewards?,
)

data class DuelMatchResponse(
    val id: UUID,
    val mode: MatchMode,
    val sourceId: UUID,
    val home: List<MatchParticipant>,
    val away: List<MatchParticipant>,
    val homeScore: Int,
    val awayScore: Int,
    val outcome: MatchOutcome,
    val events: List<DuelPlaybackEvent>,
    val statistics: MatchStatistics,
    val seed: Long,
    val engineVersion: String,
    val createdAt: Instant,
)

private fun StoredMatch.toResponse() =
    DuelMatchResponse(
        id = id,
        mode = request.mode,
        sourceId = requireNotNull(sourceId),
        home = request.home,
        away = request.away,
        homeScore = result.homeScore,
        awayScore = result.awayScore,
        outcome = result.outcome,
        events = playbackEvents(result.events),
        statistics = result.statistics,
        seed = result.seed,
        engineVersion = result.engineVersion,
        createdAt = createdAt,
    )
