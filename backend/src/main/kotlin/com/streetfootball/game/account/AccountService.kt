package com.streetfootball.game.account

import org.springframework.dao.DuplicateKeyException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.security.crypto.password.PasswordEncoder
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.time.Instant
import java.util.Locale
import java.util.UUID

data class Account(
    val id: UUID,
    val email: String,
    val passwordHash: String,
    val currentProfileId: UUID?,
)

@Service
class AccountService(
    private val jdbc: JdbcTemplate,
    private val passwords: PasswordEncoder,
) {
    fun findByEmail(email: String): Account? =
        jdbc
            .query("SELECT * FROM app_user WHERE email = ?", { row, _ ->
                Account(
                    row.getObject("id", UUID::class.java),
                    row.getString("email"),
                    row.getString("password_hash"),
                    row.getObject("current_profile_id", UUID::class.java),
                )
            }, normalizeEmail(email))
            .singleOrNull()

    fun findById(id: UUID): Account? =
        jdbc
            .query("SELECT * FROM app_user WHERE id = ?", { row, _ ->
                Account(
                    row.getObject("id", UUID::class.java),
                    row.getString("email"),
                    row.getString("password_hash"),
                    row.getObject("current_profile_id", UUID::class.java),
                )
            }, id)
            .singleOrNull()

    @Transactional
    fun register(
        email: String,
        password: String,
    ) {
        if (password.length !in 12..72 || password.toByteArray(Charsets.UTF_8).size > 72) throw InvalidPasswordException()
        val now = Instant.now()
        try {
            jdbc.update(
                "INSERT INTO app_user (id, email, password_hash, created_at, updated_at) VALUES (?, ?, ?, ?, ?)",
                UUID.randomUUID(),
                normalizeEmail(email),
                passwords.encode(password),
                java.sql.Timestamp.from(now),
                java.sql.Timestamp.from(now),
            )
        } catch (_: DuplicateKeyException) {
            throw AccountAlreadyExistsException()
        }
    }

    private fun normalizeEmail(email: String) = email.trim().lowercase(Locale.ROOT)
}

class AccountAlreadyExistsException : RuntimeException()

class InvalidPasswordException : RuntimeException()
