package com.streetfootball.game.match

import com.streetfootball.game.challenge.ChallengeMatchService
import com.streetfootball.game.challenge.IdempotencyConflictException
import com.streetfootball.game.challenge.playbackEvents
import com.streetfootball.game.match.domain.CoachedDuelEngine
import com.streetfootball.game.profile.GameProfileRepository
import com.streetfootball.game.profile.ProfileNotFoundException
import com.streetfootball.game.stadium.StadiumDuelCommand
import com.streetfootball.game.stadium.StadiumService
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID
import kotlin.math.ceil

@Service
class CoachedMatchService(
    private val profiles: GameProfileRepository,
    private val sessions: CoachedMatchRepository,
    private val matches: MatchRepository,
    private val challenges: ChallengeMatchService,
    private val stadiums: StadiumService,
) {
    private val engine = CoachedDuelEngine()

    @Transactional
    fun start(
        profileId: UUID,
        key: UUID,
        command: StartCoachedMatch,
    ): CoachedMatchResponse {
        profiles.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        sessions.byKey(profileId, key)?.let {
            if (it.command != command) throw IdempotencyConflictException()
            // Start retry always returns the original step-zero receipt, even after completion.
            return response(it.copy(state = engine.start(it.prepared.request), finalMatchId = null))
        }
        if (matches.findByKey(profileId, key) != null) throw IdempotencyConflictException()
        matches.requireIdle(profileId)
        val prepared =
            if (command.challengerId != null) {
                challenges.prepare(profileId, command.challengerId, command.ownedPlayerId, CoachedDuelEngine.VERSION)
            } else {
                stadiums.prepare(
                    profileId,
                    requireNotNull(command.stadiumId),
                    StadiumDuelCommand(command.ownedPlayerId, command.roundNumber, command.seriesId),
                    CoachedDuelEngine.VERSION,
                )
            }
        val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
        val session = CoachedSession(UUID.randomUUID(), key, command, prepared, engine.start(prepared.request), now)
        sessions.insert(session)
        return response(session)
    }

    @Transactional(readOnly = true)
    fun active(profileId: UUID): CoachedMatchResponse? = sessions.active(profileId)?.let(::response)

    @Transactional(readOnly = true)
    fun get(
        profileId: UUID,
        id: UUID,
    ): CoachedMatchResponse = response(sessions.get(profileId, id))

    @Transactional
    fun advance(
        profileId: UUID,
        id: UUID,
        key: UUID,
        command: AdvanceCoachedMatch,
    ): CoachedMatchResponse {
        profiles.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        sessions.prior(profileId, key, id, command)?.let { return it }
        val previous = sessions.get(profileId, id)
        if (previous.state.finished || command.step != previous.state.step) throw CoachedMatchException("MATCH_STEP_CHANGED")
        var next = previous.copy(state = engine.advance(previous.prepared.request, previous.state, command.instruction))
        if (next.state.finished) {
            val input = next.prepared.request.copy(coaching = next.state.instructions)
            next = next.copy(prepared = next.prepared.copy(request = input))
            val result = engine.result(input, next.state)
            val fatigueCost = ceil(next.state.homeEffort).toInt()
            if (next.prepared.stadiumId == null) {
                challenges.complete(next.prepared, next.key, result, next.id, fatigueCost)
            } else {
                stadiums.complete(next.prepared, next.key, result, next.id, fatigueCost)
            }
            next = next.copy(finalMatchId = next.id)
        }
        val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
        sessions.update(next, now)
        val response = response(next)
        sessions.record(profileId, key, id, command, response, now)
        return response
    }

    private fun response(session: CoachedSession): CoachedMatchResponse {
        val state = session.state
        val input = session.prepared.request
        val final = session.finalMatchId?.let { requireNotNull(matches.findByKey(session.prepared.profileId, session.key)) }
        val events = playbackEvents(state.events)
        val last = events.lastOrNull()
        return CoachedMatchResponse(
            CoachedMatchView(
                session.id,
                input.mode,
                session.prepared.sourceId?.toString() ?: requireNotNull(session.prepared.stadiumId),
                input.home,
                input.away,
                last?.homeScore ?: 0,
                last?.awayScore ?: 0,
                final?.result?.outcome,
                events,
                final?.result?.penalties,
                CoachedDuelEngine.VERSION,
                session.createdAt,
            ),
            state.step,
            CoachedDuelEngine.STEPS,
            state.elapsedSeconds,
            state.finished,
            state.instructions.lastOrNull() ?: com.streetfootball.game.match.domain
                .CoachInstruction(),
            (session.prepared.homeFatigue + state.homeEffort).coerceAtMost(100.0),
            (session.prepared.awayFatigue + state.awayEffort).coerceAtMost(100.0),
            session.prepared.roundNumber,
            final?.rewards,
            final?.stadiumRewards,
        )
    }
}
