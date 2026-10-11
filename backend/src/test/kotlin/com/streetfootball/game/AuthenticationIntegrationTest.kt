package com.streetfootball.game

import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.ActiveProfiles
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.net.CookieManager
import java.net.URI
import java.net.URLEncoder
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.nio.charset.StandardCharsets.UTF_8
import java.util.UUID
import java.util.concurrent.CompletableFuture
import kotlin.test.assertEquals
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

@ActiveProfiles("production")
@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT, properties = ["server.servlet.session.cookie.secure=false"])
class AuthenticationIntegrationTest {
    @LocalServerPort private var port = 0

    @Autowired private lateinit var jdbc: JdbcTemplate

    @Autowired private lateinit var json: ObjectMapper

    private val password = "Senha-de-teste-123"

    private inner class Browser {
        val client = HttpClient.newBuilder().cookieHandler(CookieManager()).build()

        fun send(
            method: String,
            path: String,
            body: String? = null,
            csrf: Boolean = true,
            key: UUID? = null,
            form: Boolean = false,
        ): HttpResponse<String> {
            val token = if (method != "GET" && csrf) status() else null
            val request = HttpRequest.newBuilder(URI("http://localhost:$port/api/v1$path"))
            token?.let { request.header(it["csrfHeader"].asString(), it["csrfToken"].asString()) }
            key?.let { request.header("Idempotency-Key", it.toString()) }
            if (body != null) request.header("Content-Type", if (form) "application/x-www-form-urlencoded" else "application/json")
            return client.send(
                request.method(method, body?.let(HttpRequest.BodyPublishers::ofString) ?: HttpRequest.BodyPublishers.noBody()).build(),
                HttpResponse.BodyHandlers.ofString(),
            )
        }

        fun status(): JsonNode = json.readTree(send("GET", "/auth").body())

        fun register(email: String) =
            send("POST", "/auth/register", json.writeValueAsString(mapOf("email" to email, "password" to password)))

        fun login(
            email: String,
            value: String = password,
        ) = send("POST", "/auth/login", "email=${URLEncoder.encode(email, UTF_8)}&password=${URLEncoder.encode(value, UTF_8)}", form = true)

        fun profile() = json.readTree(send("GET", "/profile").body())
    }

    @Test
    fun `production requires account and CSRF while passwords are hashed and login rotates session`() {
        val browser = Browser()
        val email = "${UUID.randomUUID()}@example.com"
        assertEquals(401, browser.send("GET", "/profile").statusCode())
        assertEquals(403, browser.send("POST", "/auth/register", "{}", csrf = false).statusCode())
        assertEquals(400, browser.send("POST", "/auth/register", """{"email":"$email","password":"short"}""").statusCode())
        assertEquals(201, browser.register(email).statusCode())
        assertEquals(409, browser.register(email.uppercase()).statusCode())
        val hash = jdbc.queryForObject("SELECT password_hash FROM app_user WHERE email = ?", String::class.java, email)!!
        assertNotEquals(password, hash)
        assertTrue(hash.startsWith("\$2a\$") || hash.startsWith("\$2b\$"))
        assertEquals(401, browser.login(email, "wrong-password").statusCode())
        assertEquals(401, browser.login(email, "a".repeat(100)).statusCode())
        val before = jdbc.queryForObject("SELECT session_id FROM spring_session ORDER BY creation_time DESC LIMIT 1", String::class.java)
        assertEquals(200, browser.login(email.uppercase()).statusCode())
        val after =
            jdbc.queryForObject(
                "SELECT session_id FROM spring_session WHERE principal_name IS NOT NULL ORDER BY creation_time DESC LIMIT 1",
                String::class.java,
            )
        assertNotEquals(before, after)
        assertEquals(true, browser.status()["authenticated"].asBoolean())
        assertEquals(403, browser.send("POST", "/profiles", """{"displayName":"Teste"}""", csrf = false).statusCode())
        assertEquals(201, browser.send("POST", "/profiles", """{"displayName":"Teste"}""").statusCode())
        assertEquals(200, browser.send("POST", "/auth/logout").statusCode())
        assertEquals(false, browser.status()["authenticated"].asBoolean())
        assertEquals(401, browser.send("GET", "/roster").statusCode())
    }

    @Test
    fun `new login restores only its account save and new game is durable and concurrent idempotent`() {
        val first = Browser()
        val email = "${UUID.randomUUID()}@example.com"
        assertEquals(201, first.register(email).statusCode())
        assertEquals(200, first.login(email).statusCode())
        assertEquals(true, first.status()["authenticated"].asBoolean())
        val key = UUID.randomUUID()
        val body = """{"displayName":"Primeira"}"""
        val commands =
            (1..2)
                .map {
                    CompletableFuture.supplyAsync {
                        first.send(
                            "POST",
                            "/profile/new-game",
                            body,
                            key = key,
                        )
                    }
                }.map { it.get() }
        assertTrue(commands.all { it.statusCode() == 201 })
        val profile = json.readTree(commands[0].body())
        assertEquals(profile, json.readTree(commands[1].body()))
        val starter = json.readTree(first.send("POST", "/profile/starter", """{"playerDefinitionId":"starter_leo"}""").body())

        val other = Browser()
        val otherEmail = "${UUID.randomUUID()}@example.com"
        assertEquals(201, other.register(otherEmail).statusCode())
        assertEquals(200, other.login(otherEmail).statusCode())
        assertEquals(404, other.send("GET", "/profile").statusCode())
        assertEquals(201, other.send("POST", "/profiles", """{"displayName":"Outro"}""").statusCode())
        assertEquals(
            403,
            other
                .send(
                    "POST",
                    "/training/sessions",
                    """{"ownedPlayerId":"${starter["id"].asString()}","focus":"SPEED"}""",
                    key = UUID.randomUUID(),
                ).statusCode(),
        )
        assertNotEquals(profile["id"], other.profile()["id"])

        val newDevice = Browser()
        assertEquals(200, newDevice.login(email).statusCode())
        assertEquals(profile["id"], newDevice.profile()["id"])
        assertEquals(1, json.readTree(newDevice.send("GET", "/roster").body()).size())
        assertEquals(profile, json.readTree(newDevice.send("POST", "/profile/new-game", body, key = key).body()))
        assertEquals(409, newDevice.send("POST", "/profile/new-game", """{"displayName":"Conflito"}""", key = key).statusCode())
        val latest =
            json.readTree(
                newDevice.send("POST", "/profile/new-game", """{"displayName":"Nova"}""", key = UUID.randomUUID()).body(),
            )
        assertNotEquals(profile["id"], latest["id"])
        assertEquals(latest["id"], first.profile()["id"])
        // Retrying an old receipt does not switch the account back to an archived journey.
        newDevice.send("POST", "/profile/new-game", body, key = key)
        assertEquals(latest["id"], newDevice.profile()["id"])
        assertEquals(
            1,
            jdbc.queryForObject(
                "SELECT count(*) FROM owned_player WHERE profile_id = ?",
                Int::class.java,
                UUID.fromString(profile["id"].asString()),
            ),
        )
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
