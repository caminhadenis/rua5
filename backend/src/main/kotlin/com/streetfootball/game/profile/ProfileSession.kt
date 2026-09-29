package com.streetfootball.game.profile

import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpSession
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class ProfileSession {
    fun currentProfileId(request: HttpServletRequest): UUID? =
        request
            .getSession(false)
            ?.getAttribute(PROFILE_ID_ATTRIBUTE)
            ?.toString()
            ?.let(UUID::fromString)

    fun requireProfileId(request: HttpServletRequest): UUID = currentProfileId(request) ?: throw ProfileNotFoundException()

    fun attach(
        session: HttpSession,
        profileId: UUID,
    ) {
        session.setAttribute(PROFILE_ID_ATTRIBUTE, profileId)
    }

    private companion object {
        const val PROFILE_ID_ATTRIBUTE = "gameProfileId"
    }
}
