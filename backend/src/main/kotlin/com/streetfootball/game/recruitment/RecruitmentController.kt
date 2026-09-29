package com.streetfootball.game.recruitment

import com.streetfootball.game.profile.ProfileSession
import jakarta.servlet.http.HttpServletRequest
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PathVariable
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
class RecruitmentController(
    private val session: ProfileSession,
    private val service: RecruitmentService,
) {
    @GetMapping("/api/v1/challenges/{id}")
    fun info(
        @PathVariable id: UUID,
        request: HttpServletRequest,
    ) = service.info(session.requireProfileId(request), id)

    // Naturally idempotent command: the resource is (session profile, challenger).
    @PostMapping("/api/v1/challenges/{id}/recruit")
    fun recruit(
        @PathVariable id: UUID,
        request: HttpServletRequest,
    ) = service.recruit(session.requireProfileId(request), id)
}
