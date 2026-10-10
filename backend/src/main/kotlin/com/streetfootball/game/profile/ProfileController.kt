package com.streetfootball.game.profile

import com.streetfootball.game.challenge.IdempotencyConflictException
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Pattern
import jakarta.validation.constraints.Size
import org.springframework.http.HttpStatus
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RequestMapping
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.time.Instant
import java.util.UUID

@RestController
@RequestMapping("/api/v1")
class ProfileController(
    private val profileService: ProfileService,
    private val profileSession: ProfileSession,
) {
    @PostMapping("/profiles")
    @ResponseStatus(HttpStatus.CREATED)
    fun create(
        @Valid @RequestBody body: CreateProfileRequest,
        request: HttpServletRequest,
    ): ProfileResponse {
        if (profileSession.currentProfileId(request) != null) {
            throw ProfileAlreadyExistsException()
        }

        val profile = profileService.create(body.displayName, body.primaryColor, body.secondaryColor)
        profileSession.attach(request.getSession(true), profile.id)
        return profile.toResponse()
    }

    @PostMapping("/profile/new-game")
    @ResponseStatus(HttpStatus.CREATED)
    fun newGame(
        @Valid @RequestBody body: CreateProfileRequest,
        @RequestHeader("Idempotency-Key") key: UUID,
        request: HttpServletRequest,
    ): ProfileResponse {
        val session = request.getSession(true)
        synchronized(session) {
            val previous = session.getAttribute("newGameCommand") as? NewGameCommand
            if (previous?.key == key) {
                if (previous.body != body) throw IdempotencyConflictException()
                return profileService.load(previous.profileId).toResponse()
            }
            val profile = profileService.create(body.displayName, body.primaryColor, body.secondaryColor)
            profileSession.attach(session, profile.id)
            session.setAttribute("newGameCommand", NewGameCommand(key, body, profile.id))
            return profile.toResponse()
        }
    }

    private data class NewGameCommand(
        val key: UUID,
        val body: CreateProfileRequest,
        val profileId: UUID,
    ) : java.io.Serializable

    @GetMapping("/profile")
    fun load(request: HttpServletRequest): ProfileResponse = profileService.load(profileSession.requireProfileId(request)).toResponse()
}

data class CreateProfileRequest(
    @field:NotBlank
    @field:Size(max = 40)
    val displayName: String,
    @field:Pattern(regexp = "^#[0-9a-fA-F]{6}$")
    val primaryColor: String = "#f7d154",
    @field:Pattern(regexp = "^#[0-9a-fA-F]{6}$")
    val secondaryColor: String = "#24354a",
)

data class ProfileResponse(
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

private fun GameProfile.toResponse() =
    ProfileResponse(
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
