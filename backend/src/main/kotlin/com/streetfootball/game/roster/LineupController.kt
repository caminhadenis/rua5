package com.streetfootball.game.roster

import com.streetfootball.game.profile.ProfileSession
import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Size
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PutMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
class LineupController(
    private val session: ProfileSession,
    private val service: LineupService,
) {
    @GetMapping("/api/v1/lineup")
    fun get(request: HttpServletRequest) = service.get(session.requireProfileId(request))

    @PutMapping("/api/v1/lineup")
    fun replace(
        @Valid @RequestBody body: UpdateLineupRequest,
        request: HttpServletRequest,
    ) = service.replace(session.requireProfileId(request), body.ownedPlayerIds)
}

data class UpdateLineupRequest(
    @field:Size(min = 5, max = 5) val ownedPlayerIds: List<UUID?>,
)
