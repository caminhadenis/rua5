package com.streetfootball.game.recruitment

import com.streetfootball.game.challenge.ChallengerNotAvailableException
import com.streetfootball.game.challenge.ChallengerProgress
import com.streetfootball.game.challenge.ChallengerProgressRepository
import com.streetfootball.game.challenge.ChallengerRepository
import com.streetfootball.game.profile.GameProfileRepository
import com.streetfootball.game.profile.ProfileNotFoundException
import com.streetfootball.game.roster.OwnedPlayerEntity
import com.streetfootball.game.roster.OwnedPlayerRepository
import com.streetfootball.game.roster.PlayerDefinitionRepository
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class RecruitmentService(
    private val profiles: GameProfileRepository,
    private val challengers: ChallengerRepository,
    private val definitions: PlayerDefinitionRepository,
    private val progress: ChallengerProgressRepository,
    private val owned: OwnedPlayerRepository,
) {
    @Transactional(readOnly = true)
    fun info(
        profileId: UUID,
        challengerId: UUID,
    ): ChallengeInfo {
        val profile = profiles.findById(profileId).orElseThrow(::ProfileNotFoundException)
        val challenger = challengers.findById(challengerId) ?: throw ChallengerNotAvailableException()
        if (!challenger.enabled ||
            (profile.currentMapId != null && profile.currentMapId != challenger.mapId)
        ) {
            throw ChallengerNotAvailableException()
        }
        val definition = definitions.findById(challenger.playerDefinitionId).orElseThrow(::ChallengerNotAvailableException)
        if (!definition.enabled) throw ChallengerNotAvailableException()
        val history = progress.find(profileId, challengerId)
        return ChallengeInfo(challenger.id, definition.name, challenger.level, definition.recruitable, history.recruitmentStatus, history)
    }

    @Transactional
    fun recruit(
        profileId: UUID,
        challengerId: UUID,
    ): RecruitmentResponse {
        // Same lock as matches and starter selection: serializes even retries with different HTTP requests.
        val profile = profiles.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        val challenger = challengers.findById(challengerId) ?: throw ChallengerNotAvailableException()
        val history = progress.find(profileId, challengerId)
        val existing = owned.findByProfileIdAndPlayerDefinitionId(profileId, challenger.playerDefinitionId)
        // Stable response containing identity only, unaffected by later XP, levels or availability changes.
        if (history.recruitmentStatus == RecruitmentStatus.RECRUITED) {
            return RecruitmentResponse(challengerId, checkNotNull(existing).id)
        }
        if (!profile.starterSelected ||
            !challenger.enabled ||
            (profile.currentMapId != null && profile.currentMapId != challenger.mapId)
        ) {
            throw ChallengerNotAvailableException()
        }
        val definition = definitions.findById(challenger.playerDefinitionId).orElseThrow(::ChallengerNotAvailableException)
        if (!definition.enabled) throw ChallengerNotAvailableException()
        RecruitmentPolicy.requireAvailable(history.recruitmentStatus, definition.recruitable)
        val player =
            existing ?: owned.saveAndFlush(
                OwnedPlayerEntity(
                    profileId = profileId,
                    playerDefinitionId = definition.id,
                    level = challenger.level,
                ),
            )
        progress.markRecruited(profileId, challengerId)
        return RecruitmentResponse(challengerId, player.id)
    }
}

data class RecruitmentResponse(
    val challengerId: UUID,
    val ownedPlayerId: UUID,
)

data class ChallengeInfo(
    val id: UUID,
    val name: String,
    val level: Int,
    val recruitable: Boolean,
    val recruitmentStatus: RecruitmentStatus,
    val progress: ChallengerProgress,
)
