package com.streetfootball.game.roster

import com.streetfootball.game.profile.ProfileSession
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.DecimalMax
import jakarta.validation.constraints.DecimalMin
import jakarta.validation.constraints.Pattern
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
class DismissalController(
    private val session: ProfileSession,
    private val service: DismissalService,
) {
    @PostMapping("/api/v1/roster/{id}/dismiss")
    fun dismiss(
        @PathVariable id: UUID,
        @RequestHeader("Idempotency-Key") key: UUID,
        @Valid @RequestBody location: DismissalLocation,
        request: HttpServletRequest,
    ) = service.dismiss(session.requireProfileId(request), id, key, location)

    @GetMapping("/api/v1/maps/{mapId}/released-players")
    fun released(
        @PathVariable mapId: String,
        request: HttpServletRequest,
    ) = service.list(session.requireProfileId(request), mapId)
}

data class DismissalLocation(
    @field:Pattern(regexp = "benfica") val mapId: String,
    @field:DecimalMin("16") @field:DecimalMax("2288") val x: Double,
    @field:DecimalMin("16") @field:DecimalMax("2672") val y: Double,
)
