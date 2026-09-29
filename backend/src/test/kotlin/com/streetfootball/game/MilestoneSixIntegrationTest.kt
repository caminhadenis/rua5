package com.streetfootball.game

import com.streetfootball.game.match.domain.MatchEngine
import com.streetfootball.game.match.domain.MatchEvent
import com.streetfootball.game.match.domain.MatchEventType
import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchRequest
import com.streetfootball.game.match.domain.MatchResult
import com.streetfootball.game.match.domain.MatchSide
import com.streetfootball.game.match.domain.MatchStatistics
import com.streetfootball.game.match.domain.SideStatistics
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.context.TestConfiguration
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.context.annotation.Bean
import org.springframework.context.annotation.Primary
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.testcontainers.postgresql.PostgreSQLContainer
import tools.jackson.databind.JsonNode
import tools.jackson.databind.ObjectMapper
import java.net.CookieManager
import java.net.URI
import java.net.http.HttpClient
import java.net.http.HttpRequest
import java.net.http.HttpResponse
import java.util.UUID
import java.util.concurrent.Callable
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertTrue

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MilestoneSixIntegrationTest {
    @LocalServerPort private var port = 0

    @Autowired private lateinit var jdbc: JdbcTemplate

    @Autowired private lateinit var json: ObjectMapper

    @Autowired private lateinit var engine: ControlledEngine

    @BeforeEach
    fun reset() {
        for (table in listOf(
            "user_trophy",
            "user_lineup",
            "game_match",
            "challenger_progress",
            "owned_player",
            "game_profile",
            "stadium_requirement",
        )) {
            jdbc.update("DELETE FROM $table")
        }
        jdbc.update("UPDATE stadium SET enabled = TRUE, map_id = 'benfica'")
        jdbc.update("UPDATE player_definition SET enabled = TRUE")
        engine.outcome = MatchOutcome.WIN
        engine.real = false
        engine.shootout = false
    }

    @TestConfiguration(proxyBeanMethods = false)
    class EngineConfig {
        @Bean @Primary
        fun controlledEngine() = ControlledEngine()
    }

    class ControlledEngine : MatchEngine {
        var outcome = MatchOutcome.WIN
        var real = false
        var shootout = false

        override fun simulate(request: MatchRequest): MatchResult {
            if (real) {
                return com.streetfootball.game.match.domain
                    .VersionedMatchEngine()
                    .simulate(request)
            }
            if (shootout) {
                return MatchResult(
                    0,
                    0,
                    MatchOutcome.WIN,
                    listOf(
                        MatchEvent(1, 31, MatchEventType.PENALTY_GOAL, MatchSide.HOME, request.home.first().playerId),
                        MatchEvent(2, 31, MatchEventType.PENALTY_MISSED, MatchSide.AWAY, request.away.first().playerId),
                    ),
                    MatchStatistics(SideStatistics(0, 0, 0, 0, 0), SideStatistics(0, 0, 0, 0, 0)),
                    request.seed,
                    request.engineVersion,
                    com.streetfootball.game.match.domain
                        .PenaltyScore(1, 0),
                )
            }
            val home = if (outcome == MatchOutcome.WIN) 1 else 0
            val away = if (outcome == MatchOutcome.LOSS) 1 else 0
            val side = if (home == 1) MatchSide.HOME else MatchSide.AWAY
            return MatchResult(
                home,
                away,
                outcome,
                listOf(MatchEvent(1, 1, MatchEventType.GOAL, side, (if (home == 1) request.home else request.away).first().playerId)),
                MatchStatistics(SideStatistics(1, 0, 0, home, home), SideStatistics(1, 0, 0, away, away)),
                request.seed,
                request.engineVersion,
            )
        }
    }

    @Test
    fun `four rejected five allowed trophy blocks new keys but original snapshot survives lineup and content changes`() {
        val p = player()
        val ids = five(p)
        putLineup(p, ids.take(4) + null)
        assertError(play(p), 409, "LINEUP_INCOMPLETE")
        assertEquals(0, count("game_match"))
        putLineup(p, ids)
        val key = UUID.randomUUID()
        val win = body(play(p, key))
        assertEquals("STADIUM_5V5", win.path("match").path("mode").asString())
        assertEquals(5, win.path("match").path("home").size())
        assertEquals(5, win.path("match").path("away").size())
        assertEquals(5, win.path("rewards").path("players").size())
        assertEquals(
            "trophy_benfica",
            win
                .path("rewards")
                .path("trophy")
                .path("id")
                .asString(),
        )
        assertEquals(1, count("user_trophy"))
        assertEquals(5, jdbc.queryForObject("SELECT sum(wins)::integer FROM owned_player", Int::class.java))
        assertEquals("COMPLETED", body(get(p, "/stadiums/benfica_stadium")).path("status").asString())
        assertError(play(p), 409, "STADIUM_ALREADY_COMPLETED")
        val rosterBefore = roster(p)
        putLineup(p, List(5) { null })
        jdbc.update("UPDATE stadium SET enabled = FALSE")
        jdbc.update("UPDATE game_profile SET current_map_id = 'other'")
        assertEquals(win, body(play(p, key)))
        assertEquals(rosterBefore, roster(p))
        assertEquals(1, count("game_match"))
        assertError(send(p.client, "POST", "/stadiums/unknown/matches", "{}", key), 409, "IDEMPOTENCY_CONFLICT")
        assertError(duel(p, key), 409, "IDEMPOTENCY_CONFLICT")
    }

    @Test
    fun `loss allows retry XP applies to five and keys are shared with duels`() {
        val p = player()
        putLineup(p, five(p))
        val duelKey = UUID.randomUUID()
        body(duel(p, duelKey))
        assertError(play(p, duelKey), 409, "IDEMPOTENCY_CONFLICT")
        engine.outcome = MatchOutcome.LOSS
        val key = UUID.randomUUID()
        val loss = body(play(p, key))
        assertTrue(loss.path("rewards").path("trophy").isNull)
        assertEquals(0, count("user_trophy"))
        assertEquals(5, jdbc.queryForObject("SELECT sum(losses)::integer FROM owned_player", Int::class.java))
        val before = roster(p)
        assertEquals(loss, body(play(p, key)))
        assertEquals(before, roster(p))
        body(play(p))
        engine.outcome = MatchOutcome.WIN
        body(play(p))
        assertEquals(1, count("user_trophy"))
    }

    @Test
    fun `access requirements disabled participants malformed key and session are enforced`() {
        val p = player()
        val ids = five(p)
        putLineup(p, ids)
        assertError(send(client(), "POST", "/stadiums/benfica_stadium/matches", "{}", UUID.randomUUID()), 404, "PROFILE_NOT_FOUND")
        assertError(send(p.client, "POST", "/stadiums/benfica_stadium/matches"), 400, "MALFORMED_REQUEST")
        assertError(send(p.client, "POST", "/stadiums/unknown/matches", "{}", UUID.randomUUID()), 404, "STADIUM_NOT_FOUND")
        jdbc.update("INSERT INTO stadium_requirement VALUES ('benfica_stadium', 'trophy_benfica')")
        assertError(play(p), 409, "STADIUM_REQUIREMENT_NOT_MET")
        assertEquals("LOCKED", body(get(p, "/stadiums/benfica_stadium")).path("status").asString())
        jdbc.update("DELETE FROM stadium_requirement")
        jdbc.update("UPDATE game_profile SET current_map_id = 'other' WHERE id = ?", p.profileId)
        assertError(play(p), 409, "STADIUM_LOCKED")
        jdbc.update("UPDATE game_profile SET current_map_id = NULL WHERE id = ?", p.profileId)
        jdbc.update("UPDATE stadium SET enabled = FALSE")
        assertError(play(p), 409, "STADIUM_LOCKED")
        jdbc.update("UPDATE stadium SET enabled = TRUE")
        jdbc.update("UPDATE player_definition SET enabled = FALSE WHERE id = 'starter_leo'")
        assertError(play(p), 404, "OWNED_PLAYER_NOT_FOUND")
        val other = playerWithStarter("starter_breno")
        assertError(putLineup(other, ids), 403, "PLAYER_NOT_OWNED")
        assertEquals(0, count("game_match"))
    }

    @Test
    fun `commit failure rolls back match five XP updates trophy and key then retry succeeds`() {
        val p = player()
        putLineup(p, five(p))
        val before = roster(p)
        val key = UUID.randomUUID()
        jdbc.execute("CREATE FUNCTION fail_m6() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''fail''; END;'")
        try {
            jdbc.execute(
                "CREATE CONSTRAINT TRIGGER fail_m6 AFTER INSERT ON user_trophy DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_m6()",
            )
            assertError(play(p, key), 500, "INTERNAL_ERROR")
            assertEquals(before, roster(p))
            assertEquals(0, count("game_match"))
            assertEquals(0, count("user_trophy"))
        } finally {
            jdbc.execute("DROP TRIGGER fail_m6 ON user_trophy")
            jdbc.execute("DROP FUNCTION fail_m6()")
        }
        body(play(p, key))
        assertEquals(1, count("user_trophy"))
    }

    @Test
    fun `concurrent identical keys return one result and different keys cannot win twice`() {
        for (sameKey in listOf(true, false)) {
            val p = player()
            putLineup(p, five(p))
            val key = UUID.randomUUID()
            Executors.newFixedThreadPool(6).use { executor ->
                val results =
                    (1..6)
                        .map {
                            executor.submit(Callable { play(p, if (sameKey) key else UUID.randomUUID()) })
                        }.map { it.get(30, TimeUnit.SECONDS) }
                val successes = results.filter { it.statusCode() == 200 }
                assertEquals(if (sameKey) 6 else 1, successes.size)
                assertEquals(1, successes.map { body(it) }.distinct().size)
                results.filter { it.statusCode() != 200 }.forEach { assertError(it, 409, "STADIUM_ALREADY_COMPLETED") }
            }
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM game_match WHERE profile_id = ?", Int::class.java, p.profileId))
        }
    }

    @Test
    fun `real engine endpoint persists reproducible snapshots including penalty results`() {
        engine.real = true
        val p = player()
        putLineup(p, five(p))
        body(play(p))
        val snapshot = jdbc.queryForObject("SELECT request_snapshot::text FROM game_match", String::class.java)!!
        val result =
            com.streetfootball.game.match.domain.VersionedMatchEngine().simulate(
                json.readValue(snapshot, MatchRequest::class.java),
            )
        assertEquals(result.homeScore, jdbc.queryForObject("SELECT home_score FROM game_match", Int::class.java))
        assertEquals(result.outcome.name, jdbc.queryForObject("SELECT outcome FROM game_match", String::class.java))
        assertEquals(14, jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success", Int::class.java))
    }

    @Test
    fun `database prevents foreign profile trophy duplicate trophy invalid opponent slots and stadium draws`() {
        val p = player()
        val other = player()
        putLineup(p, five(p))
        val win = body(play(p))
        assertFailsWith<DataIntegrityViolationException> { jdbc.update("UPDATE user_trophy SET profile_id = ?", other.profileId) }
        assertFailsWith<DataIntegrityViolationException> { jdbc.update("INSERT INTO user_trophy SELECT * FROM user_trophy") }
        assertFailsWith<DataIntegrityViolationException> {
            jdbc.update(
                "UPDATE stadium_opponent_player SET slot_index = 6 WHERE slot_index = 1",
            )
        }
        assertFailsWith<DataIntegrityViolationException> {
            jdbc.update(
                "UPDATE game_match SET home_score = 0, away_score = 0, outcome = 'DRAW' WHERE id = ?",
                UUID.fromString(win.path("match").path("id").asString()),
            )
        }
    }

    @Test
    fun `penalty victory stores separate scores awards trophy and unlocks data driven requirements`() {
        val p = player()
        putLineup(p, five(p))
        jdbc.update("INSERT INTO trophy_definition VALUES ('fixture_trophy', 'Fixture', 'Fixture') ON CONFLICT DO NOTHING")
        jdbc.update(
            "INSERT INTO stadium SELECT 'fixture_stadium', name, type, map_id, 'fixture.entry', difficulty, keeper_base, 'fixture_trophy', enabled FROM stadium WHERE id = 'benfica_stadium' ON CONFLICT DO NOTHING",
        )
        jdbc.update(
            "INSERT INTO stadium_opponent_player SELECT 'fixture_stadium', slot_index, player_definition_id, level FROM stadium_opponent_player WHERE stadium_id = 'benfica_stadium' ON CONFLICT DO NOTHING",
        )
        jdbc.update("INSERT INTO stadium_requirement VALUES ('fixture_stadium', 'trophy_benfica')")
        assertEquals("LOCKED", body(get(p, "/stadiums/fixture_stadium")).path("status").asString())
        engine.shootout = true
        val key = UUID.randomUUID()
        val win = body(play(p, key))
        assertEquals(0, win.path("match").path("homeScore").asInt())
        assertEquals(
            1,
            win
                .path("match")
                .path("penalties")
                .path("home")
                .asInt(),
        )
        assertEquals("WIN", win.path("match").path("outcome").asString())
        assertEquals(win, body(play(p, key)))
        assertEquals(1, count("user_trophy"))
        assertTrue(win.path("match").path("events").all { it.path("homeScore").asInt() == 0 })
        assertEquals("AVAILABLE", body(get(p, "/stadiums/fixture_stadium")).path("status").asString())
    }

    private fun five(p: Player): List<UUID> {
        val ids = mutableListOf(p.ownedId)
        for (definition in listOf("npc_nilo_01", "starter_breno", "starter_rafa", "stadium_lia")) {
            val id = UUID.randomUUID()
            jdbc.update(
                "INSERT INTO owned_player (id, profile_id, player_definition_id, recruited_at) VALUES (?, ?, ?, now())",
                id,
                p.profileId,
                definition,
            )
            ids += id
        }
        return ids
    }

    private fun count(table: String) = jdbc.queryForObject("SELECT count(*) FROM $table", Int::class.java)

    private fun play(
        p: Player,
        key: UUID = UUID.randomUUID(),
    ) = send(p.client, "POST", "/stadiums/benfica_stadium/matches", "{}", key)

    private fun playerWithStarter(starter: String): Player {
        val client = client()
        val profile = body(send(client, "POST", "/profiles", """{"displayName":"M6"}"""))
        val owned = body(send(client, "POST", "/profile/starter", """{"playerDefinitionId":"$starter"}"""))
        return Player(client, UUID.fromString(profile.path("id").asString()), UUID.fromString(owned.path("id").asString()))
    }

    private fun player(): Player {
        val client = client()
        val profile = body(send(client, "POST", "/profiles", """{"displayName":"M5"}"""))
        val owned = body(send(client, "POST", "/profile/starter", """{"playerDefinitionId":"starter_leo"}"""))
        return Player(client, UUID.fromString(profile.path("id").asString()), UUID.fromString(owned.path("id").asString()))
    }

    private fun client() = HttpClient.newBuilder().cookieHandler(CookieManager()).build()

    private fun get(
        p: Player,
        path: String,
    ) = send(p.client, "GET", path)

    private fun recruit(p: Player) = send(p.client, "POST", "/challenges/$NILO/recruit")

    private fun duel(
        p: Player,
        key: UUID = UUID.randomUUID(),
    ) = send(p.client, "POST", "/challenges/$NILO/matches", """{"ownedPlayerId":"${p.ownedId}"}""", key)

    private fun roster(p: Player) = body(get(p, "/roster"))

    private fun lineup(p: Player) = body(get(p, "/lineup")).path("ownedPlayerIds").toList().map { if (it.isNull) null else it.asString() }

    private fun putLineup(
        p: Player,
        ids: List<UUID?>,
    ) = send(
        p.client,
        "PUT",
        "/lineup",
        json.writeValueAsString(
            mapOf(
                "ownedPlayerIds" to ids,
            ),
        ),
    )

    private fun send(
        client: HttpClient,
        method: String,
        path: String,
        body: String = "{}",
        key: UUID? = null,
    ): HttpResponse<String> {
        val builder = HttpRequest.newBuilder(URI("http://localhost:$port/api/v1$path")).header("Content-Type", "application/json")
        if (key != null) builder.header("Idempotency-Key", key.toString())
        builder.method(method, if (method == "GET") HttpRequest.BodyPublishers.noBody() else HttpRequest.BodyPublishers.ofString(body))
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString())
    }

    private fun body(response: HttpResponse<String>): JsonNode {
        assertTrue(response.statusCode() in 200..299, response.body())
        return json.readTree(response.body())
    }

    private fun assertError(
        response: HttpResponse<String>,
        status: Int,
        code: String,
    ) {
        assertEquals(status, response.statusCode(), response.body())
        val error = json.readTree(response.body())
        assertEquals(code, error.path("code").asString())
        assertTrue(error.path("traceId").asString().isNotBlank())
    }

    private data class Player(
        val client: HttpClient,
        val profileId: UUID,
        val ownedId: UUID,
    )

    companion object {
        private val NILO = UUID.fromString("00000000-0000-4000-8000-000000000001")
        private val postgres = PostgreSQLContainer("postgres:18.6-alpine").apply { start() }

        @JvmStatic @DynamicPropertySource
        fun database(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
        }
    }
}
