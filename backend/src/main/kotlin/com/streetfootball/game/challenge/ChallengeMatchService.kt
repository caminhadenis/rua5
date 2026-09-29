package com.streetfootball.game.challenge

import com.streetfootball.game.match.MatchRepository
import com.streetfootball.game.match.StoredMatch
import com.streetfootball.game.match.domain.DuelMatchEngine
import com.streetfootball.game.match.domain.MatchEngine
import com.streetfootball.game.match.domain.MatchMode
import com.streetfootball.game.match.domain.MatchRequest
import com.streetfootball.game.match.snapshot
import com.streetfootball.game.profile.GameProfileRepository
import com.streetfootball.game.profile.ProfileNotFoundException
import com.streetfootball.game.progression.DuelRewards
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

        val challenger = challengers.findById(challengerId) ?: throw ChallengerNotAvailableException()
        if (!challenger.enabled || (profile.currentMapId != null && profile.currentMapId != challenger.mapId)) {
            throw ChallengerNotAvailableException()
        }
        val owned = ownedPlayers.findById(ownedPlayerId).orElseThrow(::OwnedPlayerNotFoundException)
        if (owned.profileId != profileId) throw PlayerNotOwnedException()
        val home = definitions.findById(owned.playerDefinitionId).orElseThrow(::OwnedPlayerNotFoundException)
        val away = definitions.findById(challenger.playerDefinitionId).orElseThrow(::ChallengerNotAvailableException)
        if (!away.enabled) throw ChallengerNotAvailableException()
        if (!home.enabled) throw OwnedPlayerNotFoundException()

        val input =
            MatchRequest(
                mode = MatchMode.DUEL_1V1,
                home = listOf(home.snapshot(owned.id.toString(), owned.level, owned)),
                away = listOf(away.snapshot(challenger.id.toString(), challenger.level)),
                seed = seedGenerator.nextLong(),
                engineVersion = DuelMatchEngine.VERSION,
            )
        val started = System.nanoTime()
        val result = engine.simulate(input)
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
            )
        owned.level = advanced.level
        owned.xp = advanced.xp
        owned.wins += progress.wins - previous.wins
        owned.draws += progress.draws - previous.draws
        owned.losses += progress.losses - previous.losses
        val match =
            StoredMatch(
                id = UUID.randomUUID(),
                profileId = profileId,
                sourceId = challengerId,
                ownedPlayerId = ownedPlayerId,
                idempotencyKey = key,
                request = input,
                result = result,
                rewards = rewards,
                // Match PostgreSQL timestamp precision so the first response equals a persisted retry.
                createdAt = Instant.now().truncatedTo(ChronoUnit.MICROS),
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
