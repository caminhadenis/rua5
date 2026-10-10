package com.streetfootball.game

import org.hamcrest.Matchers.hasSize
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.dao.DuplicateKeyException
import org.springframework.http.MediaType
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.mock.web.MockHttpSession
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.test.web.servlet.MockMvc
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get
import org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath
import org.springframework.test.web.servlet.result.MockMvcResultMatchers.status
import org.springframework.test.web.servlet.setup.MockMvcBuilders
import org.springframework.web.context.WebApplicationContext
import org.testcontainers.postgresql.PostgreSQLContainer
import java.util.UUID
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith

@SpringBootTest
class MilestoneOneIntegrationTest {
    @Autowired
    private lateinit var context: WebApplicationContext

    @Autowired
    private lateinit var jdbcTemplate: JdbcTemplate

    private lateinit var mockMvc: MockMvc

    @BeforeEach
    fun resetProfiles() {
        jdbcTemplate.update("DELETE FROM owned_player")
        jdbcTemplate.update("DELETE FROM game_profile")
        mockMvc = MockMvcBuilders.webAppContextSetup(context).build()
    }

    @Test
    fun `migrations seed exactly the three enabled starters`() {
        mockMvc
            .perform(get("/api/v1/starters"))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$", hasSize<Any>(3)))
            .andExpect(jsonPath("$[0].id").value("starter_breno"))
            .andExpect(jsonPath("$[0].name").value("Aderlou"))
            .andExpect(jsonPath("$[1].id").value("starter_leo"))
            .andExpect(jsonPath("$[1].name").value("Cabeleira"))
            .andExpect(jsonPath("$[2].id").value("starter_rafa"))
            .andExpect(jsonPath("$[2].name").value("Loraco"))

        assertEquals(
            3,
            jdbcTemplate.queryForObject(
                "SELECT count(*) FROM player_definition WHERE starter AND enabled",
                Int::class.java,
            ),
        )
    }

    @Test
    fun `creates and reloads the current profile from its server session`() {
        val session = createProfile("  Denis  ")

        mockMvc
            .perform(get("/api/v1/profile").session(session))
            .andExpect(status().isOk)
            .andExpect(jsonPath("$.displayName").value("Denis"))
            .andExpect(jsonPath("$.starterSelected").value(false))

        mockMvc
            .perform(get("/api/v1/profile"))
            .andExpect(status().isNotFound)
            .andExpect(jsonPath("$.code").value("PROFILE_NOT_FOUND"))
    }

    @Test
    fun `selecting a starter is idempotent and cannot be changed`() {
        val session = createProfile("Denis")

        val first = selectStarter(session, "starter_leo").andReturn()
        val firstOwnedPlayerId =
            first.response.contentAsString
                .substringAfter("\"id\":\"")
                .substringBefore('"')

        selectStarter(session, "starter_leo")
            .andExpect(jsonPath("$.id").value(firstOwnedPlayerId))

        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM owned_player", Int::class.java))
        assertEquals(
            true,
            jdbcTemplate.queryForObject("SELECT starter_selected FROM game_profile", Boolean::class.java),
        )

        mockMvc
            .perform(
                post("/api/v1/profile/starter")
                    .session(session)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"playerDefinitionId":"starter_rafa"}"""),
            ).andExpect(status().isConflict)
            .andExpect(jsonPath("$.code").value("STARTER_ALREADY_SELECTED"))

        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM owned_player", Int::class.java))
    }

    @Test
    fun `database rejects a duplicate owned player for the same profile`() {
        val session = createProfile("Denis")
        selectStarter(session, "starter_breno")

        val profileId =
            jdbcTemplate.queryForObject(
                "SELECT profile_id FROM owned_player",
                UUID::class.java,
            )!!

        assertFailsWith<DuplicateKeyException> {
            jdbcTemplate.update(
                """
                INSERT INTO owned_player (
                    id, profile_id, player_definition_id, level, xp, wins, draws, losses, recruited_at, version
                )
                VALUES (?, ?, 'starter_breno', 1, 0, 0, 0, 0, now(), 0)
                """.trimIndent(),
                UUID.randomUUID(),
                profileId,
            )
        }

        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM owned_player", Int::class.java))
    }

    @Test
    fun `team colors are normalized persisted and scoped to the profile session`() {
        val result =
            mockMvc
                .perform(
                    post("/api/v1/profiles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"displayName":"Cores","primaryColor":"#AA22CC","secondaryColor":"#00BBFF"}"""),
                ).andExpect(status().isCreated)
                .andExpect(jsonPath("$.primaryColor").value("#aa22cc"))
                .andExpect(jsonPath("$.secondaryColor").value("#00bbff"))
                .andReturn()
        val session = result.request.getSession(false) as MockHttpSession
        selectStarter(session, "starter_leo")
        mockMvc
            .perform(get("/api/v1/profile").session(session))
            .andExpect(jsonPath("$.primaryColor").value("#aa22cc"))
            .andExpect(jsonPath("$.secondaryColor").value("#00bbff"))
        val other = createProfile("Outro")
        mockMvc
            .perform(get("/api/v1/profile").session(other))
            .andExpect(jsonPath("$.primaryColor").value("#f7d154"))
            .andExpect(jsonPath("$.secondaryColor").value("#24354a"))
    }

    @Test
    fun `invalid colors are rejected by the API and database`() {
        for (field in listOf("primaryColor", "secondaryColor")) {
            for (invalid in listOf("red", "#fff", "#gg0000", "", "#1234567")) {
                mockMvc
                    .perform(
                        post("/api/v1/profiles")
                            .contentType(MediaType.APPLICATION_JSON)
                            .content("""{"displayName":"Cores","$field":"$invalid"}"""),
                    ).andExpect(status().isBadRequest)
            }
        }
        assertEquals(0, jdbcTemplate.queryForObject("SELECT count(*) FROM game_profile", Int::class.java))
        createProfile("Defaults")
        assertFailsWith<DataIntegrityViolationException> {
            jdbcTemplate.update("UPDATE game_profile SET primary_color = 'invalid'")
        }
        assertFailsWith<DataIntegrityViolationException> {
            jdbcTemplate.update("UPDATE game_profile SET secondary_color = '#gggggg'")
        }
    }

    @Test
    fun `new game creates a clean profile and retry recovers it without deleting previous progress`() {
        val session = createProfile("Primeiro")
        selectStarter(session, "starter_leo")
        val key = UUID.randomUUID()

        fun start(name: String = "Novo") =
            mockMvc.perform(
                post("/api/v1/profile/new-game")
                    .session(session)
                    .header("Idempotency-Key", key)
                    .contentType(MediaType.APPLICATION_JSON)
                    .content("""{"displayName":"$name","primaryColor":"#2266aa","secondaryColor":"#dd3344"}"""),
            )
        val first = start().andExpect(status().isCreated).andExpect(jsonPath("$.starterSelected").value(false)).andReturn()
        val newId =
            first.response.contentAsString
                .substringAfter("\"id\":\"")
                .substringBefore('"')
        start().andExpect(status().isCreated).andExpect(jsonPath("$.id").value(newId))
        start("Outro").andExpect(status().isConflict).andExpect(jsonPath("$.code").value("IDEMPOTENCY_CONFLICT"))
        mockMvc.perform(get("/api/v1/profile").session(session)).andExpect(jsonPath("$.id").value(newId))
        mockMvc.perform(get("/api/v1/roster").session(session)).andExpect(jsonPath("$", hasSize<Any>(0)))
        assertEquals(2, jdbcTemplate.queryForObject("SELECT count(*) FROM game_profile", Int::class.java))
        assertEquals(1, jdbcTemplate.queryForObject("SELECT count(*) FROM owned_player", Int::class.java))
    }

    private fun createProfile(displayName: String): MockHttpSession {
        val result =
            mockMvc
                .perform(
                    post("/api/v1/profiles")
                        .contentType(MediaType.APPLICATION_JSON)
                        .content("""{"displayName":"$displayName"}"""),
                ).andExpect(status().isCreated)
                .andReturn()

        return result.request.getSession(false) as MockHttpSession
    }

    private fun selectStarter(
        session: MockHttpSession,
        playerDefinitionId: String,
    ) = mockMvc
        .perform(
            post("/api/v1/profile/starter")
                .session(session)
                .contentType(MediaType.APPLICATION_JSON)
                .content("""{"playerDefinitionId":"$playerDefinitionId"}"""),
        ).andExpect(status().isOk)

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
