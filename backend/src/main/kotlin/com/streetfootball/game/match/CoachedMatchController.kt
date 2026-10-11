package com.streetfootball.game.match

import com.streetfootball.game.challenge.DuelPlaybackEvent
import com.streetfootball.game.match.domain.CoachInstruction
import com.streetfootball.game.match.domain.MatchMode
import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchParticipant
import com.streetfootball.game.match.domain.PenaltyScore
import com.streetfootball.game.profile.ProfileSession
import com.streetfootball.game.progression.DuelRewards
import com.streetfootball.game.stadium.StadiumDuelCommand
import com.streetfootball.game.stadium.StadiumRewards
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Max
import jakarta.validation.constraints.Min
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

data class StartCoachedMatch(
    val ownedPlayerId: UUID,
    val challengerId: UUID? = null,
    val stadiumId: String? = null,
    val seriesId: UUID? = null,
    val roundNumber: Int = 1,
)

data class AdvanceCoachedMatch(
    @field:Min(0) @field:Max(4) val step: Int,
    val instruction: CoachInstruction,
)

data class CoachedMatchView(
    val id: UUID,
    val mode: MatchMode,
    val sourceId: String,
    val home: List<MatchParticipant>,
    val away: List<MatchParticipant>,
    val homeScore: Int,
    val awayScore: Int,
    val outcome: MatchOutcome?,
    val events: List<DuelPlaybackEvent>,
    val penalties: PenaltyScore?,
    val engineVersion: String,
    val createdAt: Instant,
)

data class CoachedMatchResponse(
    val match: CoachedMatchView,
    val step: Int,
    val totalSteps: Int,
    val elapsedSeconds: Int,
    val finished: Boolean,
    val instruction: CoachInstruction,
    val homeFatigue: Double,
    val awayFatigue: Double,
    val roundNumber: Int?,
    val rewards: DuelRewards?,
    val stadiumRewards: StadiumRewards?,
)

@RestController
class CoachedMatchController(
    private val service: CoachedMatchService,
    private val session: ProfileSession,
) {
    @PostMapping("/api/v1/challenges/{id}/coached-matches")
    fun challenge(
        @PathVariable id: UUID,
        @RequestHeader("Idempotency-Key") key: UUID,
        @RequestBody body: CoachedChallengeRequest,
        request: HttpServletRequest,
    ) = service.start(session.requireProfileId(request), key, StartCoachedMatch(body.ownedPlayerId, challengerId = id))

    @PostMapping("/api/v1/stadiums/{id}/coached-matches")
    fun stadium(
        @PathVariable id: String,
        @RequestHeader("Idempotency-Key") key: UUID,
        @Valid @RequestBody body: StadiumDuelCommand,
        request: HttpServletRequest,
    ) = service.start(
        session.requireProfileId(request),
        key,
        StartCoachedMatch(body.ownedPlayerId, stadiumId = id, seriesId = body.seriesId, roundNumber = body.roundNumber),
    )

    @GetMapping("/api/v1/coached-matches/active")
    fun active(request: HttpServletRequest) = ActiveCoachedMatch(service.active(session.requireProfileId(request)))

    @GetMapping("/api/v1/coached-matches/{id}")
    fun get(
        @PathVariable id: UUID,
        request: HttpServletRequest,
    ) = service.get(session.requireProfileId(request), id)

    @PostMapping("/api/v1/coached-matches/{id}/advance")
    fun advance(
        @PathVariable id: UUID,
        @RequestHeader("Idempotency-Key") key: UUID,
        @Valid @RequestBody command: AdvanceCoachedMatch,
        request: HttpServletRequest,
    ) = service.advance(session.requireProfileId(request), id, key, command)
}

data class CoachedChallengeRequest(
    val ownedPlayerId: UUID,
)

data class ActiveCoachedMatch(
    val active: CoachedMatchResponse?,
)
