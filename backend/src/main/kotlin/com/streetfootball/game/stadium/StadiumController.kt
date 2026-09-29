package com.streetfootball.game.stadium

import com.streetfootball.game.challenge.DuelPlaybackEvent
import com.streetfootball.game.challenge.playbackEvents
import com.streetfootball.game.match.domain.MatchMode
import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchParticipant
import com.streetfootball.game.match.domain.MatchStatistics
import com.streetfootball.game.match.domain.PenaltyScore
import com.streetfootball.game.profile.ProfileSession
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

@RestController
class StadiumController(
    private val service: StadiumService,
    private val session: ProfileSession,
) {
    @GetMapping("/api/v1/stadiums")
    fun list(request: HttpServletRequest) = service.list(session.requireProfileId(request))

    @GetMapping("/api/v1/stadiums/{id}")
    fun get(
        @PathVariable id: String,
        request: HttpServletRequest,
    ) = service.get(session.requireProfileId(request), id)

    @PostMapping("/api/v1/stadiums/{id}/matches")
    fun play(
        @PathVariable id: String,
        @RequestHeader("Idempotency-Key") key: UUID,
        request: HttpServletRequest,
    ): StadiumResponse {
        val stored = service.play(session.requireProfileId(request), id, key)
        val result = stored.result
        return StadiumResponse(
            StadiumMatchResponse(
                stored.id,
                stored.request.mode,
                id,
                stored.request.home,
                stored.request.away,
                result.homeScore,
                result.awayScore,
                result.outcome,
                playbackEvents(result.events),
                result.statistics,
                result.seed,
                result.engineVersion,
                result.penalties,
                stored.createdAt,
            ),
            requireNotNull(stored.stadiumRewards),
        )
    }
}

data class StadiumResponse(
    val match: StadiumMatchResponse,
    val rewards: StadiumRewards,
)

data class StadiumMatchResponse(
    val id: UUID,
    val mode: MatchMode,
    val sourceId: String,
    val home: List<MatchParticipant>,
    val away: List<MatchParticipant>,
    val homeScore: Int,
    val awayScore: Int,
    val outcome: MatchOutcome,
    val events: List<DuelPlaybackEvent>,
    val statistics: MatchStatistics,
    val seed: Long,
    val engineVersion: String,
    val penalties: PenaltyScore?,
    val createdAt: Instant,
)
