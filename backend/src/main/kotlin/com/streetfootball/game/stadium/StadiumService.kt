package com.streetfootball.game.stadium

import com.streetfootball.game.challenge.IdempotencyConflictException
import com.streetfootball.game.challenge.OwnedPlayerNotFoundException
import com.streetfootball.game.challenge.PlayerNotOwnedException
import com.streetfootball.game.match.MatchRepository
import com.streetfootball.game.match.StoredMatch
import com.streetfootball.game.match.domain.MatchEngine
import com.streetfootball.game.match.domain.MatchMode
import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchParticipant
import com.streetfootball.game.match.domain.MatchRequest
import com.streetfootball.game.match.domain.StadiumDuelEngine
import com.streetfootball.game.match.snapshot
import com.streetfootball.game.profile.GameProfileEntity
import com.streetfootball.game.profile.GameProfileRepository
import com.streetfootball.game.profile.ProfileNotFoundException
import com.streetfootball.game.progression.Progression
import com.streetfootball.game.roster.OwnedPlayerRepository
import com.streetfootball.game.roster.PlayerDefinitionRepository
import com.streetfootball.game.trophy.Trophy
import com.streetfootball.game.trophy.TrophyRepository
import org.slf4j.LoggerFactory
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.security.SecureRandom
import java.time.Instant
import java.time.temporal.ChronoUnit
import java.util.UUID

data class PlayerAward(
    val ownedPlayerId: UUID,
    val xpAwarded: Int,
    val previousLevel: Int,
    val currentLevel: Int,
    val previousXp: Int,
    val currentXp: Int,
    val xpToNextLevel: Int?,
)

data class StadiumRewards(
    val players: List<PlayerAward>,
    val trophy: Trophy?,
    val series: SeriesProgress? = null,
)

data class StadiumInfo(
    val id: String,
    val name: String,
    val type: String,
    val mapId: String,
    val spawnKey: String,
    val difficulty: Int,
    val status: String,
    val missingTrophies: List<String>,
    val opponentLineup: List<MatchParticipant>,
    val trophy: Trophy,
    val series: SeriesProgress?,
)

@Service
class StadiumService(
    private val profiles: GameProfileRepository,
    private val ownedPlayers: OwnedPlayerRepository,
    private val definitions: PlayerDefinitionRepository,
    private val stadiums: StadiumRepository,
    private val trophies: TrophyRepository,
    private val matches: MatchRepository,
    private val engine: MatchEngine,
    private val series: StadiumSeriesRepository,
) {
    private val seeds = SecureRandom()

    @Transactional(readOnly = true)
    fun list(profileId: UUID): List<StadiumInfo> {
        val profile = profiles.findById(profileId).orElseThrow(::ProfileNotFoundException)
        return stadiums.all().map { info(profile, it) }
    }

    @Transactional(readOnly = true)
    fun get(
        profileId: UUID,
        id: String,
    ): StadiumInfo = info(profiles.findById(profileId).orElseThrow(::ProfileNotFoundException), stadiums.find(id))

    private fun accessible(
        profile: GameProfileEntity,
        stadium: Stadium,
    ) = profile.starterSelected && stadium.enabled && (profile.currentMapId ?: "benfica") == stadium.mapId

    private fun info(
        profile: GameProfileEntity,
        stadium: Stadium,
    ): StadiumInfo {
        val owned = trophies.ownedIds(profile.id)
        val missing = stadiums.requirements(stadium.id).filterNot { it in owned }
        val status =
            when {
                stadium.trophyId in owned -> "COMPLETED"
                !accessible(profile, stadium) || missing.isNotEmpty() -> "LOCKED"
                else -> "AVAILABLE"
            }
        val latest = series.latest(profile.id, stadium.id)
        return StadiumInfo(
            stadium.id,
            stadium.name,
            stadium.type,
            stadium.mapId,
            stadium.spawnKey,
            stadium.difficulty,
            status,
            missing,
            latest?.takeUnless { it.finished }?.opponents ?: opponents(stadium),
            trophies.definition(stadium.trophyId),
            latest?.progress(),
        )
    }

    private fun opponents(stadium: Stadium): List<MatchParticipant> {
        val slots = stadiums.opponents(stadium.id)
        if (slots.size != 5) throw StadiumRuleException("STADIUM_LOCKED")
        return StadiumPolicy.orderedOpponents(
            slots.map { slot ->
                val definition = definitions.findById(slot.definitionId).orElseThrow { StadiumRuleException("STADIUM_LOCKED") }
                if (!definition.enabled) throw StadiumRuleException("STADIUM_LOCKED")
                definition.snapshot("${stadium.id}:${slot.slot}", slot.level)
            },
        )
    }

    @Transactional
    fun play(
        profileId: UUID,
        id: String,
        key: UUID,
        command: StadiumDuelCommand,
    ): StoredMatch {
        val profile = profiles.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        // Lookup precedes all mutable access checks, including the trophy and current lineup.
        matches.findByKey(profileId, key)?.let {
            if (it.request.mode != MatchMode.STADIUM_1V1 ||
                it.stadiumId != id ||
                it.ownedPlayerId != command.ownedPlayerId ||
                it.roundNumber != command.roundNumber ||
                it.expectedSeriesId != command.seriesId
            ) {
                throw IdempotencyConflictException()
            }
            return it
        }
        val stadium = stadiums.find(id)
        val ownedTrophies = trophies.ownedIds(profileId)
        StadiumPolicy.validate(
            stadium.trophyId in ownedTrophies,
            accessible(profile, stadium),
            stadiums.requirements(id).any { it !in ownedTrophies },
        )
        val player = ownedPlayers.findById(command.ownedPlayerId).orElseThrow(::OwnedPlayerNotFoundException)
        if (player.profileId != profileId) throw PlayerNotOwnedException()
        val definition = definitions.findById(player.playerDefinitionId).orElseThrow(::OwnedPlayerNotFoundException)
        if (!definition.enabled) throw OwnedPlayerNotFoundException()
        val latest = series.latest(profileId, id)
        val round = if (latest == null || latest.finished) 1 else latest.played + 1
        if (command.seriesId != latest?.id || command.roundNumber != round) throw StadiumRuleException("STADIUM_SEQUENCE_CHANGED")
        val attempt = latest?.takeUnless { it.finished } ?: series.start(profileId, id, opponents(stadium))
        val home = listOf(definition.snapshot(player.id.toString(), player.level, player))
        val input =
            MatchRequest(MatchMode.STADIUM_1V1, home, listOf(attempt.opponents[round - 1]), seeds.nextLong(), StadiumDuelEngine.VERSION)
        val started = System.nanoTime()
        val result = engine.simulate(input)
        check(result.outcome != MatchOutcome.DRAW)
        val attempts = stadiums.attempts(profileId, id)
        val awards =
            listOf(player).map { player ->
                // Stadium retries decay too, preventing unlimited full-XP farming of early rounds.
                val xp = Progression.reward(result.outcome, player.level, input.away.single().level, attempts, attempts)
                val advanced = Progression.advance(player.level, player.xp, xp)
                val award =
                    PlayerAward(
                        player.id,
                        xp,
                        player.level,
                        advanced.level,
                        player.xp,
                        advanced.xp,
                        if (advanced.level < Progression.MAX_LEVEL) Progression.xpForNextLevel(advanced.level) else null,
                    )
                player.level = advanced.level
                player.xp = advanced.xp
                if (result.outcome == MatchOutcome.WIN) player.wins++ else player.losses++
                award
            }
        val next = series.advance(attempt, result.outcome == MatchOutcome.WIN)
        val rewards = StadiumRewards(awards, if (next.wins == 5) trophies.definition(stadium.trophyId) else null, next.progress())
        val stored =
            StoredMatch(
                UUID.randomUUID(),
                profileId,
                null,
                player.id,
                key,
                input,
                result,
                Instant.now().truncatedTo(ChronoUnit.MICROS),
                stadiumId = id,
                stadiumRewards = rewards,
                seriesId = attempt.id,
                roundNumber = round,
                expectedSeriesId = command.seriesId,
            )
        matches.insert(stored)
        if (rewards.trophy != null) trophies.grant(profileId, stadium.trophyId, id, stored.id, stored.createdAt, attempt.id)
        logger.info(
            "Stadium persisted matchId={} profileId={} mode={} sourceId={} seed={} engineVersion={} homeScore={} awayScore={} durationMs={}",
            stored.id,
            profileId,
            input.mode,
            id,
            input.seed,
            input.engineVersion,
            result.homeScore,
            result.awayScore,
            (System.nanoTime() - started) / 1_000_000,
        )
        return stored
    }

    private companion object {
        val logger = LoggerFactory.getLogger(StadiumService::class.java)
    }
}
