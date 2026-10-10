package com.streetfootball.game.progression

import com.streetfootball.game.profile.ProfileSession
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

data class StartRecoveryRequest(
    val ownedPlayerId: UUID,
    @field:Size(min = 1, max = 64) val stationId: String,
)

@RestController
class RecoveryController(
    private val service: RecoveryService,
    private val session: ProfileSession,
) {
    @PostMapping("/api/v1/recovery/sessions")
    fun start(
        @RequestHeader("Idempotency-Key") key: UUID,
        @Valid @RequestBody body: StartRecoveryRequest,
        request: HttpServletRequest,
    ): RecoveryReceipt = service.start(session.requireProfileId(request), body.ownedPlayerId, body.stationId, key)

    @PostMapping("/api/v1/recovery/sessions/{id}/cancel")
    fun cancel(
        @RequestHeader("Idempotency-Key") key: UUID,
        @PathVariable id: UUID,
        request: HttpServletRequest,
    ): RecoveryReceipt = service.cancel(session.requireProfileId(request), id, key)
}
