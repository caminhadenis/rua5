package com.streetfootball.game.profile

import jakarta.persistence.LockModeType
import org.springframework.data.jpa.repository.JpaRepository
import org.springframework.data.jpa.repository.Lock
import org.springframework.data.jpa.repository.Query
import org.springframework.data.repository.query.Param
import java.util.UUID

interface GameProfileRepository : JpaRepository<GameProfileEntity, UUID> {
    @Lock(LockModeType.PESSIMISTIC_WRITE)
    @Query("select profile from GameProfileEntity profile where profile.id = :id")
    fun findByIdForUpdate(
        @Param("id") id: UUID,
    ): GameProfileEntity?
}
