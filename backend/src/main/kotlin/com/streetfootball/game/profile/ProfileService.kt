package com.streetfootball.game.profile

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Clock
import java.time.Instant
import java.util.UUID

@Service
class ProfileService(
    private val repository: GameProfileRepository,
    private val jdbc: JdbcTemplate,
    private val clock: Clock = Clock.systemUTC(),
) {
    @Transactional
    fun create(
        displayName: String,
        primaryColor: String = "#f7d154",
        secondaryColor: String = "#24354a",
        userId: UUID? = null,
        onlyIfEmpty: Boolean = false,
    ): GameProfile {
        if (userId != null) {
            val current =
                jdbc.query(
                    "SELECT current_profile_id FROM app_user WHERE id = ? FOR UPDATE",
                    { row, _ -> row.getObject(1, UUID::class.java) },
                    userId,
                )
            if (current.isEmpty()) throw ProfileNotFoundException()
            if (onlyIfEmpty && current.single() != null) throw ProfileAlreadyExistsException()
        }
        val now = Instant.now(clock)
        val profile =
            GameProfileEntity(
                userId = userId,
                displayName = displayName.trim(),
                primaryColor = primaryColor.lowercase(),
                secondaryColor = secondaryColor.lowercase(),
                createdAt = now,
                updatedAt = now,
            )

        val saved = repository.saveAndFlush(profile).toDomain()
        if (userId != null) jdbc.update("UPDATE app_user SET current_profile_id = ?, updated_at = now() WHERE id = ?", saved.id, userId)
        return saved
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
