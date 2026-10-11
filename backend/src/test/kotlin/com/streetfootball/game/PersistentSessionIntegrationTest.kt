package com.streetfootball.game

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.session.Session
import org.springframework.session.SessionRepository
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.ObjectMapper
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertNotNull
import kotlin.test.assertTrue

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class PersistentSessionIntegrationTest {
    @LocalServerPort private var port = 0

    @Autowired private lateinit var jdbc: JdbcTemplate

    @Autowired private lateinit var sessions: SessionRepository<out Session>

    @Autowired private lateinit var json: ObjectMapper

    @Test
    fun `real HTTP session stores profile and durable new game receipt in PostgreSQL`() {
        val key = UUID.randomUUID()
        val body = """{"displayName":"Save na nuvem"}"""

        fun command(cookie: String? = null) =
            HttpClient.newHttpClient().send(
                HttpRequest
                    .newBuilder(URI("http://localhost:$port/api/v1/profile/new-game"))
                    .header("Content-Type", "application/json")
                    .header("Idempotency-Key", key.toString())
                    .apply { cookie?.let { header("Cookie", it) } }
                    .POST(HttpRequest.BodyPublishers.ofString(body))
                    .build(),
                HttpResponse.BodyHandlers.ofString(),
            )

        val first = command()
        assertEquals(201, first.statusCode())
        val cookie = first.headers().firstValue("set-cookie").orElseThrow()
        assertTrue(cookie.contains("HttpOnly"))
        assertTrue(cookie.contains("Max-Age=604800"))
        val profile = json.readTree(first.body())
        val sessionId = jdbc.queryForObject("SELECT session_id FROM spring_session", String::class.java)!!
        val reloaded: Session = assertNotNull(sessions.findById(sessionId))
        assertEquals(UUID.fromString(profile["id"].asString()), reloaded.getAttribute<UUID>("gameProfileId"))
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM new_game_command", Int::class.java))

        // A separate client reuses only the cookie; every request reloads the JDBC session.
        assertEquals(profile, json.readTree(command(cookie.substringBefore(';')).body()))
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM game_profile", Int::class.java))
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM spring_session_attributes", Int::class.java))
        assertEquals("no-store", first.headers().firstValue("Cache-Control").orElseThrow())
    }

    companion object {
        private val postgres = PostgreSQLContainer("postgres:18.6-alpine").apply { start() }

        @JvmStatic
        @DynamicPropertySource
        fun databaseProperties(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
        }
    }
}
