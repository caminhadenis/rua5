package com.streetfootball.game.account

import jakarta.servlet.http.HttpServletRequest
import jakarta.validation.Valid
import jakarta.validation.constraints.Email
import jakarta.validation.constraints.NotBlank
import jakarta.validation.constraints.Size
import org.springframework.context.annotation.Profile
import org.springframework.core.env.Environment
import org.springframework.core.env.Profiles
import org.springframework.http.HttpStatus
import org.springframework.security.authentication.AnonymousAuthenticationToken
import org.springframework.security.core.context.SecurityContextHolder
import org.springframework.security.web.csrf.CsrfToken
import org.springframework.web.bind.annotation.GetMapping
import org.springframework.web.bind.annotation.PostMapping
import org.springframework.web.bind.annotation.RequestBody
import org.springframework.web.bind.annotation.ResponseStatus
import org.springframework.web.bind.annotation.RestController
import java.util.UUID

@RestController
class AuthController(
    private val environment: Environment,
    private val accounts: AccountService,
) {
    @GetMapping("/api/v1/auth")
    fun status(request: HttpServletRequest): AuthStatus {
        val enabled = environment.acceptsProfiles(Profiles.of("production"))
        val authentication = SecurityContextHolder.getContext().authentication
        val account =
            if (enabled && authentication?.isAuthenticated == true && authentication !is AnonymousAuthenticationToken) {
                accounts.findById(UUID.fromString(authentication.name))
            } else {
                null
            }
        val csrf = request.getAttribute(CsrfToken::class.java.name) as? CsrfToken
        return AuthStatus(enabled, account != null, account?.email, csrf?.token, csrf?.headerName)
    }
}

data class AuthStatus(
    val enabled: Boolean,
    val authenticated: Boolean,
    val email: String?,
    val csrfToken: String?,
    val csrfHeader: String?,
)

@RestController
@Profile("production")
class RegistrationController(
    private val accounts: AccountService,
) {
    @PostMapping("/api/v1/auth/register")
    @ResponseStatus(HttpStatus.CREATED)
    fun register(
        @Valid @RequestBody body: RegistrationRequest,
    ): Map<String, Boolean> {
        accounts.register(body.email, body.password)
        return mapOf("registered" to true)
    }
}

data class RegistrationRequest(
    @field:NotBlank @field:Email @field:Size(max = 254) val email: String,
    @field:Size(min = 12, max = 72) val password: String,
)
