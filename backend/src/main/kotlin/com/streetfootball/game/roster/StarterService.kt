package com.streetfootball.game.roster

import com.streetfootball.game.profile.GameProfileRepository
import com.streetfootball.game.profile.ProfileNotFoundException
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.util.UUID

@Service
class StarterService(
    private val playerDefinitionRepository: PlayerDefinitionRepository,
    private val ownedPlayerRepository: OwnedPlayerRepository,
    private val gameProfileRepository: GameProfileRepository,
    private val selectionPolicy: StarterSelectionPolicy = StarterSelectionPolicy(),
    private val clock: Clock = Clock.systemUTC(),
) {
    @Transactional(readOnly = true)
    fun list(): List<PlayerDefinition> =
        playerDefinitionRepository.findAllByStarterTrueAndEnabledTrueOrderById().map(PlayerDefinitionEntity::toDomain)

    @Transactional
    fun select(
        profileId: UUID,
        playerDefinitionId: String,
    ): OwnedPlayer {
        val definition =
            playerDefinitionRepository.findByIdAndStarterTrueAndEnabledTrue(playerDefinitionId)
                ?: throw StarterNotFoundException()
        val profile = gameProfileRepository.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        val existing = ownedPlayerRepository.findByProfileIdAndPlayerDefinitionId(profileId, definition.id)

        return when (selectionPolicy.decide(profile.starterSelected, existing != null)) {
            StarterSelectionDecision.ALREADY_GRANTED -> existing!!.toDomain()
            StarterSelectionDecision.GRANT -> {
                val now = Instant.now(clock)
                val ownedPlayer =
                    ownedPlayerRepository.save(
                        OwnedPlayerEntity(
                            profileId = profile.id,
                            playerDefinitionId = definition.id,
                            recruitedAt = now,
                        ),
                    )
                profile.markStarterSelected(now)
                ownedPlayer.toDomain()
            }
        }
    }
}

data class PlayerDefinition(
    val id: String,
    val name: String,
    val archetype: Archetype,
    val preferredRole: PreferredRole,
    val rarity: Rarity,
    val speed: Int,
    val dribbling: Int,
    val passing: Int,
    val finishing: Int,
    val defending: Int,
    val physical: Int,
)

data class OwnedPlayer(
    val id: UUID,
    val playerDefinitionId: String,
    val level: Int,
    val xp: Int,
    val wins: Int,
    val draws: Int,
    val losses: Int,
    val recruitedAt: Instant,
)

private fun PlayerDefinitionEntity.toDomain() =
    PlayerDefinition(
        id = id,
        name = name,
        archetype = archetype,
        preferredRole = preferredRole,
        rarity = rarity,
        speed = speed,
        dribbling = dribbling,
        passing = passing,
        finishing = finishing,
        defending = defending,
        physical = physical,
    )

private fun OwnedPlayerEntity.toDomain() =
    OwnedPlayer(
        id = id,
        playerDefinitionId = playerDefinitionId,
        level = level,
        xp = xp,
        wins = wins,
        draws = draws,
        losses = losses,
        recruitedAt = recruitedAt,
    )
