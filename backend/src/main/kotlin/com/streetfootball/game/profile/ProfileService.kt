package com.streetfootball.game.profile

import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.util.UUID

@Service
class ProfileService(
    private val repository: GameProfileRepository,
    private val clock: Clock = Clock.systemUTC(),
) {
    @Transactional
    fun create(
        displayName: String,
        primaryColor: String = "#f7d154",
        secondaryColor: String = "#24354a",
    ): GameProfile {
        val now = Instant.now(clock)
        val profile =
            GameProfileEntity(
                displayName = displayName.trim(),
                primaryColor = primaryColor.lowercase(),
                secondaryColor = secondaryColor.lowercase(),
                createdAt = now,
                updatedAt = now,
            )

        return repository.save(profile).toDomain()
    }

    @Transactional(readOnly = true)
    fun load(id: UUID): GameProfile = repository.findById(id).orElseThrow(::ProfileNotFoundException).toDomain()
}

data class GameProfile(
    val id: UUID,
    val displayName: String,
    val starterSelected: Boolean,
    val primaryColor: String,
    val secondaryColor: String,
    val currentMapId: String?,
    val currentSpawnKey: String?,
    val createdAt: Instant,
    val updatedAt: Instant,
)

internal fun GameProfileEntity.toDomain() =
    GameProfile(
        id = id,
        displayName = displayName,
        starterSelected = starterSelected,
        primaryColor = primaryColor,
        secondaryColor = secondaryColor,
        currentMapId = currentMapId,
        currentSpawnKey = currentSpawnKey,
        createdAt = createdAt,
        updatedAt = updatedAt,
    )
