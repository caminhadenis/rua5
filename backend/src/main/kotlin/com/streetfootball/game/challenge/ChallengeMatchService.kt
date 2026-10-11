package com.streetfootball.game.challenge

import com.streetfootball.game.match.MatchRepository
import com.streetfootball.game.match.PreparedDuel
import com.streetfootball.game.match.StoredMatch
import com.streetfootball.game.match.domain.CoachedDuelEngine
import com.streetfootball.game.match.domain.DuelMatchEngine
import com.streetfootball.game.match.domain.MatchEngine
import com.streetfootball.game.match.domain.MatchMode
import com.streetfootball.game.match.domain.MatchRequest
import com.streetfootball.game.match.domain.MatchResult
import com.streetfootball.game.match.snapshot
import com.streetfootball.game.profile.GameProfileRepository
import com.streetfootball.game.profile.ProfileNotFoundException
import com.streetfootball.game.progression.DuelRewards
import com.streetfootball.game.progression.FatiguePolicy
import com.streetfootball.game.progression.Progression
import com.streetfootball.game.recruitment.RecruitmentPolicy
import com.streetfootball.game.recruitment.RecruitmentStatus
import com.streetfootball.game.roster.OwnedPlayerRepository
import com.streetfootball.game.roster.PlayerDefinitionRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

@Service
class ChallengeMatchService(
    private val profiles: GameProfileRepository,
    private val ownedPlayers: OwnedPlayerRepository,
    private val definitions: PlayerDefinitionRepository,
    private val challengers: ChallengerRepository,
    private val matches: MatchRepository,
    private val engine: MatchEngine,
    private val progressRepository: ChallengerProgressRepository,
) {
    private val seedGenerator = SecureRandom()

    @Transactional
    fun play(
        profileId: UUID,
        challengerId: UUID,
        ownedPlayerId: UUID,
        key: UUID,
    ): StoredMatch {
        // Serializes commands for one profile across requests/instances, including starter selection.
        // The DB unique constraint remains the final guard. A retry reads the committed snapshot.
        val profile = profiles.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        matches.findByKey(profileId, key)?.let {
            if (it.request.mode != MatchMode.DUEL_1V1 ||
                it.sourceId != challengerId ||
                it.ownedPlayerId != ownedPlayerId
            ) {
                throw IdempotencyConflictException()
            }
            return it
        }

        matches.requireIdle(profileId)
        val prepared = prepare(profileId, challengerId, ownedPlayerId)
        return complete(prepared, key, engine.simulate(prepared.request))
    }

    @Transactional
    fun prepare(
        profileId: UUID,
        challengerId: UUID,
        ownedPlayerId: UUID,
        version: String = DuelMatchEngine.VERSION,
    ): PreparedDuel {
        val profile = profiles.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        val challenger = challengers.findForProfile(profileId, challengerId) ?: throw ChallengerNotAvailableException()
        if (!challenger.enabled || (profile.currentMapId != null && profile.currentMapId != challenger.mapId)) {
            throw ChallengerNotAvailableException()
        }
        val owned = ownedPlayers.findById(ownedPlayerId).orElseThrow(::OwnedPlayerNotFoundException)
        if (owned.profileId != profileId) throw PlayerNotOwnedException()
        if (!owned.rosterActive) throw OwnedPlayerNotFoundException()
        val home = definitions.findById(owned.playerDefinitionId).orElseThrow(::OwnedPlayerNotFoundException)
        val away = definitions.findById(challenger.playerDefinitionId).orElseThrow(::ChallengerNotAvailableException)
        if (!away.enabled) throw ChallengerNotAvailableException()
        if (!home.enabled) throw OwnedPlayerNotFoundException()

        val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
        owned.requireAvailable(now)
        val fatigueBefore = owned.fatigueAt(now)
        val released = challenger.releasedOwnedPlayerId?.let { ownedPlayers.findById(it).orElseThrow(::ChallengerNotAvailableException) }
        val input =
            MatchRequest(
                mode = MatchMode.DUEL_1V1,
                home =
                    listOf(
                        home.snapshot(
                            owned.id.toString(),
                            owned.level,
                            owned,
                            if (version ==
                                CoachedDuelEngine.VERSION
                            ) {
                                0.0
                            } else {
                                fatigueBefore
                            },
                        ),
                    ),
                away =
                    listOf(
                        away.snapshot(
                            challenger.id.toString(),
                            challenger.level,
                            released,
                            if (version ==
                                CoachedDuelEngine.VERSION
                            ) {
                                0.0
                            } else {
                                released?.fatigueAt(now) ?: 0.0
                            },
                        ),
                    ),
                seed = seedGenerator.nextLong(),
                engineVersion = version,
                homeInitialFatigue = if (version == CoachedDuelEngine.VERSION) fatigueBefore else 0.0,
                awayInitialFatigue = if (version == CoachedDuelEngine.VERSION) released?.fatigueAt(now) ?: 0.0 else 0.0,
            )
        return PreparedDuel(profileId, ownedPlayerId, input, fatigueBefore, released?.fatigueAt(now) ?: 0.0, sourceId = challengerId)
    }

    @Transactional
    fun complete(
        prepared: PreparedDuel,
        key: UUID,
        result: MatchResult,
        matchId: UUID = UUID.randomUUID(),
        fatigueCost: Int? = null,
    ): StoredMatch {
        val profileId = prepared.profileId
        val challengerId = requireNotNull(prepared.sourceId)
        val ownedPlayerId = prepared.ownedPlayerId
        val owned = ownedPlayers.findById(ownedPlayerId).orElseThrow(::OwnedPlayerNotFoundException)
        val challenger = challengers.findForProfile(profileId, challengerId) ?: throw ChallengerNotAvailableException()
        val away = definitions.findById(challenger.playerDefinitionId).orElseThrow(::ChallengerNotAvailableException)
        val input = prepared.request
        val now = Instant.now().truncatedTo(ChronoUnit.MICROS)
        val started = System.nanoTime()
        val previous = progressRepository.find(profileId, challengerId)
        val awarded = Progression.reward(result.outcome, owned.level, challenger.level, previous.wins, previous.attempts)
        val advanced = Progression.advance(owned.level, owned.xp, awarded)
        val progress =
            previous.record(result.outcome).copy(
                recruitmentStatus = RecruitmentPolicy.afterMatch(previous.recruitmentStatus, result.outcome, away.recruitable),
            )
        val rewards =
            DuelRewards(
                owned.id,
                awarded,
                owned.level,
                advanced.level,
                owned.xp,
                advanced.xp,
                if (advanced.level < Progression.MAX_LEVEL) Progression.xpForNextLevel(advanced.level) else null,
                progress,
                previous.recruitmentStatus == RecruitmentStatus.LOCKED && progress.recruitmentStatus == RecruitmentStatus.AVAILABLE,
                if (fatigueCost ==
                    null
                ) {
                    owned.addFatigue(FatiguePolicy.DUEL_COST, now)
                } else {
                    owned.finishCoachedFatigue(prepared.homeFatigue, fatigueCost, now)
                },
            )
        owned.level = advanced.level
        owned.xp = advanced.xp
        owned.wins += progress.wins - previous.wins
        owned.draws += progress.draws - previous.draws
        owned.losses += progress.losses - previous.losses
        val match =
            StoredMatch(
                id = matchId,
                profileId = profileId,
                sourceId = challengerId,
                ownedPlayerId = ownedPlayerId,
                idempotencyKey = key,
                request = input,
                result = result,
                rewards = rewards,
                // Match PostgreSQL timestamp precision so the first response equals a persisted retry.
                createdAt = now,
            )
        progressRepository.save(profileId, challengerId, progress, match.createdAt)
        matches.insert(match)
        logger.info(
            "Duel persisted matchId={} profileId={} mode={} sourceId={} seed={} engineVersion={} homeScore={} awayScore={} durationMs={}",
            match.id,
            profileId,
            input.mode,
            challengerId,
            input.seed,
            input.engineVersion,
            match.result.homeScore,
            match.result.awayScore,
            (System.nanoTime() - started) / 1_000_000,
        )
        return match
    }

    private companion object {
        val logger = LoggerFactory.getLogger(ChallengeMatchService::class.java)
    }
}

class ChallengerNotAvailableException : RuntimeException("Challenger is unavailable.")

class OwnedPlayerNotFoundException : RuntimeException("Owned player is unavailable.")

class PlayerNotOwnedException : RuntimeException("Player belongs to a different profile.")

class IdempotencyConflictException : RuntimeException("Idempotency key was already used for another command.")
