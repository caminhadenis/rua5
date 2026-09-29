package com.streetfootball.game.roster

import org.springframework.data.jpa.repository.JpaRepository
import java.util.UUID

interface PlayerDefinitionRepository : JpaRepository<PlayerDefinitionEntity, String> {
    fun findAllByStarterTrueAndEnabledTrueOrderById(): List<PlayerDefinitionEntity>

    fun findByIdAndStarterTrueAndEnabledTrue(id: String): PlayerDefinitionEntity?
}

interface OwnedPlayerRepository : JpaRepository<OwnedPlayerEntity, UUID> {
    fun findByProfileIdAndPlayerDefinitionId(
        profileId: UUID,
        playerDefinitionId: String,
    ): OwnedPlayerEntity?

    fun findAllByProfileIdOrderByRecruitedAt(profileId: UUID): List<OwnedPlayerEntity>

    fun countByProfileId(profileId: UUID): Long
}
