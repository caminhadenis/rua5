package com.streetfootball.game.profile

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.Id
import jakarta.persistence.Table
import jakarta.persistence.Version
import java.time.Instant
import java.util.UUID

@Entity
@Table(name = "game_profile")
class GameProfileEntity(
    @field:Id
    var id: UUID = UUID.randomUUID(),
    @field:Column(name = "user_id")
    var userId: UUID? = null,
    @field:Column(name = "display_name", nullable = false, length = 40)
    var displayName: String = "",
    @field:Column(name = "starter_selected", nullable = false)
    var starterSelected: Boolean = false,
    @field:Column(name = "primary_color", nullable = false, length = 7)
    var primaryColor: String = "#f7d154",
    @field:Column(name = "secondary_color", nullable = false, length = 7)
    var secondaryColor: String = "#24354a",
    @field:Column(name = "current_map_id", length = 64)
    var currentMapId: String? = null,
    @field:Column(name = "current_spawn_key", length = 128)
    var currentSpawnKey: String? = null,
    @field:Column(name = "created_at", nullable = false)
    var createdAt: Instant = Instant.now(),
    @field:Column(name = "updated_at", nullable = false)
    var updatedAt: Instant = Instant.now(),
    @field:Version
    @field:Column(nullable = false)
    var version: Long = 0,
) {
    fun markStarterSelected(now: Instant) {
        starterSelected = true
        updatedAt = now
    }
}
