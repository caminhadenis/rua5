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
            "stadium_series",
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
    fun `one owned athlete wins all five in strength order and trophy only appears on final win`() {
        val p = player()
        assertEquals("AVAILABLE", body(get(p, "/stadiums/benfica_stadium")).path("status").asString())
        val ordered = body(get(p, "/stadiums/benfica_stadium")).path("opponentLineup")
        val snapshots = ordered.toList().map { json.treeToValue(it, com.streetfootball.game.match.domain.MatchParticipant::class.java) }
        assertEquals(
            snapshots,
            com.streetfootball.game.stadium.StadiumPolicy
                .orderedOpponents(snapshots),
        )
        var finalKey = UUID.randomUUID()
        var finalCommand = ""
        var finalResult: JsonNode? = null
        for (round in 1..5) {
            val key = UUID.randomUUID()
            val cmd = command(p)
            val result = body(play(p, key, cmd))
            assertEquals("STADIUM_1V1", result.path("match").path("mode").asString())
            assertEquals(1, result.path("match").path("home").size())
            assertEquals(1, result.path("match").path("away").size())
            assertEquals(ordered[round - 1], result.path("match").path("away")[0])
            assertEquals(1, result.path("rewards").path("players").size())
            assertEquals(
                round,
                result
                    .path("rewards")
                    .path("series")
                    .path("wins")
                    .asInt(),
            )
            assertEquals(if (round == 5) 1 else 0, count("user_trophy"))
            val roster = roster(p)
            assertEquals(result, body(play(p, key, cmd)))
            assertEquals(roster, roster(p))
            finalKey = key
            finalCommand = cmd
            finalResult = result
        }
        assertEquals(5, count("game_match"))
        assertEquals(5, jdbc.queryForObject("SELECT sum(wins)::integer FROM owned_player", Int::class.java))
        assertEquals("COMPLETED", body(get(p, "/stadiums/benfica_stadium")).path("status").asString())
        assertError(play(p), 409, "STADIUM_ALREADY_COMPLETED")
        jdbc.update("UPDATE stadium SET enabled = FALSE")
        jdbc.update("UPDATE game_profile SET current_map_id = 'other'")
        assertEquals(finalResult, body(play(p, finalKey, finalCommand)))
        assertError(duel(p, finalKey), 409, "IDEMPOTENCY_CONFLICT")
        assertError(
            play(p, finalKey, finalCommand.replace(p.ownedId.toString(), UUID.randomUUID().toString())),
            409,
            "IDEMPOTENCY_CONFLICT",
        )
    }

    @Test
    fun `loss after three wins ends attempt and next command restarts first opponent with a new series`() {
        val p = player()
        repeat(3) { body(play(p)) }
        assertEquals(0, count("user_trophy"))
        val before = body(get(p, "/stadiums/benfica_stadium")).path("series")
        engine.outcome = MatchOutcome.LOSS
        val cmd = command(p)
        val key = UUID.randomUUID()
        val loss = body(play(p, key, cmd))
        assertTrue(
            loss
                .path("rewards")
                .path("series")
                .path("finished")
                .asBoolean(),
        )
        assertEquals(
            3,
            loss
                .path("rewards")
                .path("series")
                .path("wins")
                .asInt(),
        )
        assertEquals(0, count("user_trophy"))
        val after = roster(p)
        assertEquals(loss, body(play(p, key, cmd)))
        assertEquals(after, roster(p))
        engine.outcome = MatchOutcome.WIN
        val restart = body(play(p))
        assertEquals(
            1,
            restart
                .path("rewards")
                .path("series")
                .path("played")
                .asInt(),
        )
        assertTrue(before.path("id") != restart.path("rewards").path("series").path("id"))
        val first = body(get(p, "/stadiums/benfica_stadium")).path("opponentLineup")[0]
        assertEquals(first, restart.path("match").path("away")[0])
        assertError(play(p, UUID.randomUUID(), cmd), 409, "STADIUM_SEQUENCE_CHANGED")
        repeat(4) { body(play(p)) }
        assertEquals(1, count("user_trophy"))
        assertEquals(9, count("game_match"))
    }

    @Test
    fun `ownership session requirements and malformed commands cannot advance the series`() {
        val p = player()
        val other = playerWithStarter("starter_breno")
        val cmd = command(p)
        assertError(send(other.client, "POST", "/stadiums/benfica_stadium/matches", cmd, UUID.randomUUID()), 403, "PLAYER_NOT_OWNED")
        assertError(send(client(), "POST", "/stadiums/benfica_stadium/matches", cmd, UUID.randomUUID()), 404, "PROFILE_NOT_FOUND")
        assertError(send(p.client, "POST", "/stadiums/benfica_stadium/matches", "{}", UUID.randomUUID()), 400, "MALFORMED_REQUEST")
        assertError(play(p, UUID.randomUUID(), cmd.replace("\"roundNumber\":1", "\"roundNumber\":6")), 400, "VALIDATION_ERROR")
        jdbc.update("INSERT INTO stadium_requirement VALUES ('benfica_stadium', 'trophy_benfica')")
        assertError(play(p), 409, "STADIUM_REQUIREMENT_NOT_MET")
        jdbc.update("DELETE FROM stadium_requirement")
        jdbc.update("UPDATE stadium SET enabled = FALSE")
        assertError(play(p), 409, "STADIUM_LOCKED")
        jdbc.update("UPDATE stadium SET enabled = TRUE")
        jdbc.update("UPDATE player_definition SET enabled = FALSE WHERE id = 'starter_leo'")
        assertError(play(p), 404, "OWNED_PLAYER_NOT_FOUND")
        assertEquals(0, count("game_match"))
        assertEquals(0, count("stadium_series"))
    }

    @Test
    fun `commit failure rolls back final match XP series advance trophy and key`() {
        val p = player()
        repeat(4) { body(play(p)) }
        val before = roster(p)
        val key = UUID.randomUUID()
        val cmd = command(p)
        jdbc.execute("CREATE FUNCTION fail_m6() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''fail''; END;'")
        try {
            jdbc.execute(
                "CREATE CONSTRAINT TRIGGER fail_m6 AFTER INSERT ON user_trophy DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_m6()",
            )
            assertError(play(p, key, cmd), 500, "INTERNAL_ERROR")
            assertEquals(before, roster(p))
            assertEquals(4, count("game_match"))
            assertEquals(4, body(get(p, "/stadiums/benfica_stadium")).path("series").path("played").asInt())
            assertEquals(0, count("user_trophy"))
        } finally {
            jdbc.execute("DROP TRIGGER fail_m6 ON user_trophy")
            jdbc.execute("DROP FUNCTION fail_m6()")
        }
        body(play(p, key, cmd))
        assertEquals(1, count("user_trophy"))
    }

    @Test
    fun `concurrent retries produce one match and stale new keys cannot skip an opponent`() {
        val p = player()
        val cmd = command(p)
        val key = UUID.randomUUID()
        Executors.newFixedThreadPool(6).use { executor ->
            val results = (1..6).map { executor.submit(Callable { play(p, key, cmd) }) }.map { it.get(30, TimeUnit.SECONDS) }
            assertEquals(1, results.map { body(it) }.distinct().size)
        }
        assertEquals(1, count("game_match"))
        val nextCmd = command(p)
        Executors.newFixedThreadPool(6).use { executor ->
            val results =
                (1..6)
                    .map {
                        executor.submit(
                            Callable { play(p, UUID.randomUUID(), nextCmd) },
                        )
                    }.map { it.get(30, TimeUnit.SECONDS) }
            assertEquals(1, results.count { it.statusCode() == 200 })
            results.filter { it.statusCode() != 200 }.forEach { assertError(it, 409, "STADIUM_SEQUENCE_CHANGED") }
        }
        assertEquals(2, count("game_match"))
    }

    @Test
    fun `real single duel snapshot reproduces and database prevents early trophy and duplicate rounds`() {
        val p = player()
        engine.real = true
        val receipt = body(play(p))
        val snapshot = jdbc.queryForObject("SELECT request_snapshot::text FROM game_match", String::class.java)!!
        val result =
            com.streetfootball.game.match.domain.VersionedMatchEngine().simulate(
                json.readValue(snapshot, MatchRequest::class.java),
            )
        assertEquals(result.homeScore, receipt.path("match").path("homeScore").asInt())
        assertEquals(result.outcome.name, receipt.path("match").path("outcome").asString())
        assertEquals(19, jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success", Int::class.java))
        assertFailsWith<DataIntegrityViolationException> {
            jdbc.update(
                "INSERT INTO game_match SELECT gen_random_uuid(), profile_id, owned_player_id, mode, source_type, source_id, home_score, away_score, outcome, seed, engine_version, request_snapshot, events, statistics, gen_random_uuid(), created_at, rewards, stadium_id, home_penalties, away_penalties, series_id, expected_series_id, round_number FROM game_match",
            )
        }
        val seriesId =
            UUID.fromString(
                receipt
                    .path("rewards")
                    .path("series")
                    .path("id")
                    .asString(),
            )
        assertFailsWith<DataIntegrityViolationException> {
            jdbc.update(
                "INSERT INTO user_trophy(profile_id, trophy_id, stadium_id, match_id, won_at, series_id) VALUES (?, 'trophy_benfica', 'benfica_stadium', ?, now(), ?)",
                p.profileId,
                UUID.fromString(receipt.path("match").path("id").asString()),
                seriesId,
            )
        }
        assertEquals(0, count("user_trophy"))
    }

    @Test
    fun `penalty duels grant trophy only after five consecutive wins`() {
        val p = player()
        engine.shootout = true
        repeat(5) { index ->
            val key = UUID.randomUUID()
            val cmd = command(p)
            val receipt = body(play(p, key, cmd))
            assertEquals(
                1,
                receipt
                    .path("match")
                    .path("penalties")
                    .path("home")
                    .asInt(),
            )
            assertEquals(receipt, body(play(p, key, cmd)))
            assertEquals(if (index == 4) 1 else 0, count("user_trophy"))
        }
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
        command: String = command(p),
    ) = send(p.client, "POST", "/stadiums/benfica_stadium/matches", command, key)

    private fun command(p: Player): String {
        val info = body(get(p, "/stadiums/benfica_stadium"))
        val series = info.path("series")
        val round = if (series.isNull || series.path("finished").asBoolean()) 1 else series.path("played").asInt() + 1
        return json.writeValueAsString(
            mapOf(
                "ownedPlayerId" to p.ownedId,
                "roundNumber" to round,
                "seriesId" to if (series.isNull) null else series.path("id").asString(),
            ),
        )
    }

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
