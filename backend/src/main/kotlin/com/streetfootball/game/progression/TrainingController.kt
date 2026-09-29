package com.streetfootball.game.progression

import com.streetfootball.game.profile.ProfileSession
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RequestHeader
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

data class TrainPlayerRequest(val ownedPlayerId: UUID, val focus: TrainingFocus)

@RestController
class TrainingController(private val service: TrainingService, private val session: ProfileSession) {
    @GetMapping("/api/v1/training/status")
    fun status(request: HttpServletRequest): TrainingStatus = service.status(session.requireProfileId(request))

    @PostMapping("/api/v1/training/sessions")
    fun train(
        @RequestHeader("Idempotency-Key") key: UUID,
        @RequestBody body: TrainPlayerRequest,
        request: HttpServletRequest,
    ): TrainingResult = service.train(session.requireProfileId(request), body.ownedPlayerId, body.focus, key)
}
