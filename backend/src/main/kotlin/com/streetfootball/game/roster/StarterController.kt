package com.streetfootball.game.roster

import com.streetfootball.game.profile.ProfileSession
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

@RestController
@RequestMapping("/api/v1")
class StarterController(
    private val starterService: StarterService,
    private val profileSession: ProfileSession,
) {
    @GetMapping("/starters")
    fun list(): List<StarterResponse> = starterService.list().map(PlayerDefinition::toResponse)

    @PostMapping("/profile/starter")
    fun select(
        @Valid @RequestBody body: SelectStarterRequest,
        request: HttpServletRequest,
    ): OwnedPlayerResponse =
        starterService
            .select(profileSession.requireProfileId(request), body.playerDefinitionId)
            .toResponse()
}

data class SelectStarterRequest(
    @field:NotBlank
    @field:Size(max = 64)
    val playerDefinitionId: String,
)

data class StarterResponse(
    val id: String,
    val name: String,
    val archetype: Archetype,
    val preferredRole: PreferredRole,
    val rarity: Rarity,
    val stats: PlayerStatsResponse,
)

data class PlayerStatsResponse(
    val speed: Int,
    val dribbling: Int,
    val finishing: Int,
    val defending: Int,
    val physical: Int,
)

data class OwnedPlayerResponse(
    val id: UUID,
    val playerDefinitionId: String,
    val level: Int,
    val xp: Int,
    val wins: Int,
    val draws: Int,
    val losses: Int,
    val recruitedAt: Instant,
)

private fun PlayerDefinition.toResponse() =
    StarterResponse(
        id = id,
        name = name,
        archetype = archetype,
        preferredRole = preferredRole,
        rarity = rarity,
        stats =
            PlayerStatsResponse(
                speed = speed,
                dribbling = dribbling,
                finishing = finishing,
                defending = defending,
                physical = physical,
            ),
    )

private fun OwnedPlayer.toResponse() =
    OwnedPlayerResponse(
        id = id,
        playerDefinitionId = playerDefinitionId,
        level = level,
        xp = xp,
        wins = wins,
        draws = draws,
        losses = losses,
        recruitedAt = recruitedAt,
    )
