package com.streetfootball.game.roster

import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Query
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

    @Query("select p from OwnedPlayerEntity p where p.profileId = :profileId and p.rosterActive = true order by p.recruitedAt")
    fun findAllByProfileIdOrderByRecruitedAt(profileId: UUID): List<OwnedPlayerEntity>

    @Query("select count(p) from OwnedPlayerEntity p where p.profileId = :profileId and p.rosterActive = true")
    fun countByProfileId(profileId: UUID): Long
}
