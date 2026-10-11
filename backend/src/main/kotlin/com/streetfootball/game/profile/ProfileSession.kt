package com.streetfootball.game.profile

import com.streetfootball.game.account.AccountService
import jakarta.servlet.http.HttpServletRequest
import jakarta.servlet.http.HttpSession
import org.springframework.core.env.Environment
import org.springframework.core.env.Profiles
import org.springframework.stereotype.Component
import java.util.UUID

@Component
class ProfileSession(
    private val accounts: AccountService,
    private val environment: Environment,
) {
    fun currentUserId(request: HttpServletRequest): UUID? =
        if (environment.acceptsProfiles(Profiles.of("production"))) request.userPrincipal?.name?.let(UUID::fromString) else null

    fun currentProfileId(request: HttpServletRequest): UUID? {
        if (environment.acceptsProfiles(Profiles.of("production"))) {
            return currentUserId(request)?.let { accounts.findById(it)?.currentProfileId }
        }
        return request
            .getSession(false)
            ?.getAttribute(PROFILE_ID_ATTRIBUTE)
            ?.toString()
            ?.let(UUID::fromString)
    }

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
