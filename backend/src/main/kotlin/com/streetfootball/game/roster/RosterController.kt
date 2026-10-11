package com.streetfootball.game.roster

import com.streetfootball.game.match.domain.CoachedDuelEngine
import com.streetfootball.game.match.domain.MatchStats
import com.streetfootball.game.profile.ProfileSession
import com.streetfootball.game.progression.FatiguePolicy
import com.streetfootball.game.progression.FatigueStatus
import com.streetfootball.game.progression.Progression
import jakarta.servlet.http.HttpServletRequest
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

@RestController
class RosterController(
    private val session: ProfileSession,
    private val service: RosterService,
) {
    @GetMapping("/api/v1/roster")
    fun list(request: HttpServletRequest) = service.list(session.requireProfileId(request))
}

@Service
class RosterService(
    private val owned: OwnedPlayerRepository,
    private val definitions: PlayerDefinitionRepository,
) {
    @Transactional(readOnly = true)
    fun list(profileId: UUID) =
        owned.findAllByProfileIdOrderByRecruitedAt(profileId).map { player ->
            val definition = definitions.findById(player.playerDefinitionId).orElseThrow()
            val now = Instant.now()
            val recovery = player.recoveryAt(now)
            val fatigue = FatiguePolicy.status(player.fatigueAt(now), now, if (recovery != null) player.fatigue * 12.0 else 4.0)
            val permanent =
                Progression.effectiveStats(
                    MatchStats(definition.speed, definition.dribbling, definition.finishing, definition.defending, definition.physical),
                    player.level,
                    player.trainingBonuses(),
                )
            RosterPlayerResponse(
                player.id,
                player.playerDefinitionId,
                definition.name,
                player.level,
                player.xp,
                if (player.level < Progression.MAX_LEVEL) Progression.xpForNextLevel(player.level) else null,
                player.wins,
                player.draws,
                player.losses,
                definition.archetype,
                definition.preferredRole,
                permanent,
                fatigue,
                FatiguePolicy.matchStats(permanent, fatigue.value),
                recovery,
                CoachedDuelEngine.effectiveStats(permanent, fatigue.value),
            )
        }
}

data class RosterPlayerResponse(
    val id: UUID,
    val playerDefinitionId: String,
    val name: String,
    val level: Int,
    val xp: Int,
    val xpToNextLevel: Int?,
    val wins: Int,
    val draws: Int,
    val losses: Int,
    val archetype: Archetype,
    val preferredRole: PreferredRole,
    val stats: MatchStats,
    val fatigue: FatigueStatus,
    val matchStats: MatchStats,
    val recovery: com.streetfootball.game.progression.RecoveryStatus? = null,
    val coachedMatchStats: MatchStats? = null,
)
