package com.streetfootball.game.account

import com.streetfootball.game.shared.error.ApiError
import jakarta.servlet.http.HttpServletResponse
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Configuration
import org.springframework.context.annotation.Profile
import org.springframework.security.config.annotation.web.builders.HttpSecurity
import org.springframework.security.core.userdetails.User
import org.springframework.security.core.userdetails.UserDetailsService
import org.springframework.security.core.userdetails.UsernameNotFoundException
import org.springframework.security.crypto.bcrypt.BCryptPasswordEncoder
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.security.web.SecurityFilterChain
import org.springframework.stereotype.Component
import tools.jackson.databind.ObjectMapper
import java.util.UUID

@Component
class SecurityErrors(
    private val json: ObjectMapper,
) {
    fun write(
        response: HttpServletResponse,
        status: Int,
        code: String,
        message: String,
    ) {
        response.status = status
        response.contentType = "application/json"
        json.writeValue(response.outputStream, ApiError(code, message, emptyMap(), UUID.randomUUID().toString()))
    }
}

@Configuration
class PasswordConfiguration {
    @Bean
    fun passwordEncoder(): PasswordEncoder {
        val bcrypt = BCryptPasswordEncoder()
        return object : PasswordEncoder {
            override fun encode(rawPassword: CharSequence?): String? = bcrypt.encode(rawPassword)

            override fun matches(
                rawPassword: CharSequence?,
                encodedPassword: String?,
            ): Boolean =
                rawPassword != null &&
                    encodedPassword != null &&
                    rawPassword.toString().toByteArray(Charsets.UTF_8).size <= 72 &&
                    bcrypt.matches(rawPassword, encodedPassword)
        }
    }

    @Bean
    fun accountDetails(accounts: AccountService): UserDetailsService =
        UserDetailsService { email ->
            val account = accounts.findByEmail(email) ?: throw UsernameNotFoundException("Invalid credentials")
            User
                .withUsername(account.id.toString())
                .password(account.passwordHash)
                .roles("PLAYER")
                .build()
        }
}

@Configuration
@Profile("production")
class ProductionSecurityConfiguration(
    private val errors: SecurityErrors,
) {
    @Bean
    fun productionSecurity(http: HttpSecurity): SecurityFilterChain {
        http.authorizeHttpRequests { rules ->
            rules
                .requestMatchers("/health", "/error", "/api/v1/auth", "/api/v1/auth/register", "/api/v1/auth/login")
                .permitAll()
                .requestMatchers("/api/**")
                .authenticated()
                .anyRequest()
                .permitAll()
        }
        http.requestCache { it.disable() }
        http.formLogin { form ->
            form
                .loginPage("/")
                .loginProcessingUrl("/api/v1/auth/login")
                .usernameParameter("email")
                .successHandler { _, response, _ ->
                    response.contentType = "application/json"
                    response.writer.write("{\"authenticated\":true}")
                }.failureHandler { _, response, _ -> errors.write(response, 401, "INVALID_CREDENTIALS", "E-mail ou senha inválidos.") }
        }
        http.logout { logout ->
            logout.logoutUrl("/api/v1/auth/logout").logoutSuccessHandler { _, response, _ ->
                response.contentType = "application/json"
                response.writer.write("{\"authenticated\":false}")
            }
        }
        http.exceptionHandling { exceptions ->
            exceptions.authenticationEntryPoint {
                _,
                response,
                _,
                ->
                errors.write(response, 401, "AUTHENTICATION_REQUIRED", "Entre na sua conta para jogar.")
            }
            exceptions.accessDeniedHandler {
                _,
                response,
                _,
                ->
                errors.write(response, 403, "REQUEST_FORBIDDEN", "Atualize a página e tente novamente.")
            }
        }
        return http.build()
    }
}

@Configuration
@Profile("!production")
class LocalSecurityConfiguration {
    @Bean
    fun localSecurity(http: HttpSecurity): SecurityFilterChain {
        http.authorizeHttpRequests { it.anyRequest().permitAll() }.csrf { it.disable() }
        return http.build()
    }
}
