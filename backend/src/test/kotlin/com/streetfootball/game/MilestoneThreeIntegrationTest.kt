package com.streetfootball.game

import com.streetfootball.game.challenge.ChallengeMatchService
import com.streetfootball.game.match.MatchRepository
import com.streetfootball.game.match.domain.DuelMatchEngine
import com.streetfootball.game.match.domain.MatchMode
import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchParticipant
import com.streetfootball.game.match.domain.MatchRequest
import com.streetfootball.game.match.domain.MatchStats
import com.streetfootball.game.progression.Progression
import org.junit.jupiter.api.BeforeEach
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.dao.DataIntegrityViolationException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.test.context.DynamicPropertyRegistry
import org.springframework.test.context.DynamicPropertySource
import org.springframework.transaction.PlatformTransactionManager
import org.springframework.transaction.support.TransactionTemplate
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
import java.util.concurrent.CountDownLatch
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertNotEquals
import kotlin.test.assertTrue

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MilestoneThreeIntegrationTest {
    @LocalServerPort
    private var port: Int = 0

    @Autowired
    private lateinit var jdbc: JdbcTemplate

    @Autowired
    private lateinit var json: ObjectMapper

    @Autowired
    private lateinit var matches: MatchRepository

    @Autowired
    private lateinit var service: ChallengeMatchService

    @Autowired
    private lateinit var transactionManager: PlatformTransactionManager

    @BeforeEach
    fun reset() {
        jdbc.update("DELETE FROM challenger_progress")
        jdbc.update("DELETE FROM game_match")
        jdbc.update("DELETE FROM owned_player")
        jdbc.update("DELETE FROM game_profile")
        jdbc.update("UPDATE challenger SET enabled = TRUE, map_id = 'benfica'")
        jdbc.update("UPDATE player_definition SET enabled = TRUE")
        jdbc.update("UPDATE player_definition SET name = 'Nilo', finishing = 35 WHERE id = 'npc_nilo_01'")
    }

    @Test
    fun `real HTTP smoke creates profile starter duel and retries the persisted result`() {
        val player = player()
        val key = UUID.randomUUID()
        val first = duel(player, key)
        assertEquals(200, first.statusCode())
        val body = json.readTree(first.body())
        val match = body.path("match")
        assertEquals("DUEL_1V1", match.path("mode").asString())
        assertEquals("1", match.path("engineVersion").asString())
        assertEquals(
            "npc_nilo_01",
            match
                .path("away")
                .get(0)
                .path("playerDefinitionId")
                .asString(),
        )
        assertTrue(match.path("events").size() > 0)
        val events = match.path("events").toList()
        assertEquals(
            match.path("homeScore").asInt(),
            events.count {
                it.path("type").asString() == "GOAL" &&
                    it.path("side").asString() == "HOME"
            },
        )
        assertEquals(
            match.path("awayScore").asInt(),
            events.count {
                it.path("type").asString() == "GOAL" &&
                    it.path("side").asString() == "AWAY"
            },
        )

        for ((index, event) in events.withIndex()) {
            val played = events.take(index + 1)
            assertEquals(
                played.count { it.path("type").asString() == "GOAL" && it.path("side").asString() == "HOME" },
                event.path("homeScore").asInt(),
            )
            assertEquals(
                played.count { it.path("type").asString() == "GOAL" && it.path("side").asString() == "AWAY" },
                event.path("awayScore").asInt(),
            )
        }
        val persisted = matches.findByKey(player.profileId, key)!!
        assertEquals(DuelMatchEngine().simulate(persisted.request), persisted.result)
        assertEquals(match.path("seed").asLong(), persisted.request.seed)
        assertEquals(body, json.readTree(duel(player, key).body()))
        assertEquals(1, countMatches())
        assertEquals(1, jdbc.queryForObject("SELECT wins + draws + losses FROM owned_player", Int::class.java))
        assertEquals(1, jdbc.queryForObject("SELECT attempts FROM challenger_progress", Int::class.java))
        assertEquals(
            body.path("rewards").path("currentLevel").asInt(),
            jdbc.queryForObject("SELECT level FROM owned_player", Int::class.java),
        )
        assertEquals(body.path("rewards").path("currentXp").asInt(), jdbc.queryForObject("SELECT xp FROM owned_player", Int::class.java))
        assertEquals(20, jdbc.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success", Int::class.java))
    }

    @Test
    fun `retry uses historical snapshots even when opponent stats name and availability change`() {
        val player = player()
        val key = UUID.randomUUID()
        val first = json.readTree(duel(player, key).body())
        jdbc.update("UPDATE player_definition SET name = 'Changed', finishing = 99, enabled = FALSE WHERE id = 'npc_nilo_01'")
        jdbc.update("UPDATE challenger SET enabled = FALSE")
        val retry = duel(player, key)
        assertEquals(200, retry.statusCode())
        assertEquals(first, json.readTree(retry.body()))
        val persisted = matches.findByKey(player.profileId, key)!!
        assertEquals(
            35.0,
            persisted.request.away
                .single()
                .stats.finishing,
        )
        assertEquals(persisted.result, DuelMatchEngine().simulate(persisted.request))
        assertError(duel(player), 404, "CHALLENGER_NOT_AVAILABLE")
    }

    @Test
    fun `concurrent retries create exactly one match and return identical results`() {
        val player = player()
        val key = UUID.randomUUID()
        val start = CountDownLatch(1)
        Executors.newFixedThreadPool(8).use { executor ->
            val futures =
                (1..8).map {
                    executor.submit(
                        Callable {
                            start.await(10, TimeUnit.SECONDS)
                            duel(player, key)
                        },
                    )
                }
            start.countDown()
            val responses = futures.map { it.get(30, TimeUnit.SECONDS) }
            assertTrue(responses.all { it.statusCode() == 200 })
            assertEquals(1, responses.map { json.readTree(it.body()) }.distinct().size)
        }
        assertEquals(1, countMatches())
    }

    @Test
    fun `key conflicts on a different command but is scoped to the session profile`() {
        val first = player()
        val second = player()
        val key = UUID.randomUUID()
        val match = json.readTree(duel(first, key).body())
        assertError(duel(first, key, ownedId = second.ownedId), 409, "IDEMPOTENCY_CONFLICT")
        assertError(duel(first, key, challengerId = UUID.randomUUID()), 409, "IDEMPOTENCY_CONFLICT")
        val other = duel(second, key)
        assertEquals(200, other.statusCode())
        assertNotEquals(match.path("match").path("id"), json.readTree(other.body()).path("match").path("id"))
        assertEquals(200, duel(first).statusCode())
        assertEquals(3, countMatches())
    }

    @Test
    fun `session ownership and challenger availability are checked before persistence`() {
        val first = player()
        val second = player()
        assertError(duel(first, ownedId = second.ownedId), 403, "PLAYER_NOT_OWNED")
        assertError(duel(first, ownedId = UUID.randomUUID()), 404, "OWNED_PLAYER_NOT_FOUND")
        assertError(duel(first, challengerId = UUID.randomUUID()), 404, "CHALLENGER_NOT_AVAILABLE")
        assertError(duel(first.copy(client = client())), 404, "PROFILE_NOT_FOUND")
        jdbc.update("UPDATE challenger SET enabled = FALSE")
        assertError(duel(first), 404, "CHALLENGER_NOT_AVAILABLE")
        jdbc.update("UPDATE challenger SET enabled = TRUE")
        jdbc.update("UPDATE player_definition SET enabled = FALSE WHERE id = 'npc_nilo_01'")
        assertError(duel(first), 404, "CHALLENGER_NOT_AVAILABLE")
        jdbc.update("UPDATE player_definition SET enabled = TRUE")
        jdbc.update("UPDATE game_profile SET current_map_id = 'other_map' WHERE id = ?", first.profileId)
        assertError(duel(first), 404, "CHALLENGER_NOT_AVAILABLE")
        assertEquals(0, countMatches())
    }

    @Test
    fun `missing malformed and null command fields have consistent errors`() {
        val player = player()
        val path = "/api/v1/challenges/$CHALLENGER_ID/matches"
        for (key in listOf(null, "", "not-a-uuid")) {
            assertError(post(player.client, path, """{"ownedPlayerId":"${player.ownedId}"}""", key), 400, "MALFORMED_REQUEST")
        }
        for (body in listOf("{}", """{"ownedPlayerId":null}""", """{"ownedPlayerId":"bad"}""", "{")) {
            assertError(post(player.client, path, body, UUID.randomUUID().toString()), 400, "MALFORMED_REQUEST")
        }
        assertError(
            post(
                player.client,
                "/api/v1/challenges/invalid/matches",
                """{"ownedPlayerId":"${player.ownedId}"}""",
                UUID.randomUUID().toString(),
            ),
            400,
            "MALFORMED_REQUEST",
        )
        assertEquals(0, countMatches())
    }

    @Test
    fun `client supplied identity scores stats seed and version cannot control the simulation`() {
        val player = player()
        val response =
            post(
                player.client,
                "/api/v1/challenges/$CHALLENGER_ID/matches",
                """{"ownedPlayerId":"${player.ownedId}","profileId":"${UUID.randomUUID()}","homeScore":999,"xp":999,"stats":{"finishing":999},"seed":1,"engineVersion":"hacked"}""",
                UUID.randomUUID().toString(),
            )
        // Unknown fields may be ignored by Jackson, but are never used as authoritative input.
        assertEquals(200, response.statusCode())
        val match = json.readTree(response.body()).path("match")
        assertEquals("1", match.path("engineVersion").asString())
        assertTrue(match.path("homeScore").asInt() <= 10)
        assertEquals(
            58,
            match
                .path("home")
                .get(0)
                .path("stats")
                .path("finishing")
                .asInt(),
        )
        assertEquals(player.profileId, jdbc.queryForObject("SELECT profile_id FROM game_match", UUID::class.java))
    }

    @Test
    fun `outer transaction rollback removes match and releases the key for a subsequent retry`() {
        val player = player()
        val key = UUID.randomUUID()
        assertFailsWith<IllegalStateException> {
            TransactionTemplate(transactionManager).execute {
                service.play(player.profileId, CHALLENGER_ID, player.ownedId, key)
                assertEquals(1, countMatches())
                error("Force a failure after match persistence")
            }
        }
        assertEquals(0, countMatches())
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM challenger_progress", Int::class.java))
        assertEquals(0, jdbc.queryForObject("SELECT xp + wins + draws + losses FROM owned_player", Int::class.java))
        assertEquals(200, duel(player, key).statusCode())
        assertEquals(1, countMatches())
    }

    @Test
    fun `database independently rejects duplicate keys negative scores and inconsistent outcomes`() {
        val player = player()
        val key = UUID.randomUUID()
        assertEquals(200, duel(player, key).statusCode())
        val stored = matches.findByKey(player.profileId, key)!!
        assertFailsWith<DataIntegrityViolationException> { matches.insert(stored.copy(id = UUID.randomUUID())) }
        assertFailsWith<DataIntegrityViolationException> { jdbc.update("UPDATE game_match SET home_score = -1") }
        assertFailsWith<DataIntegrityViolationException> {
            jdbc.update(
                "UPDATE game_match SET home_score = 0, away_score = 0, outcome = 'WIN'",
            )
        }
        assertEquals(1, countMatches())
    }

    @Test
    fun `database failure rolls back the HTTP command and does not consume its key`() {
        val player = player()
        val key = UUID.randomUUID()
        jdbc.execute(
            """
            CREATE FUNCTION fail_match_insert() RETURNS trigger LANGUAGE plpgsql AS '
            BEGIN RAISE EXCEPTION ''Simulated storage failure''; END;'
            """.trimIndent(),
        )
        try {
            jdbc.execute(
                """
                CREATE CONSTRAINT TRIGGER fail_match_insert
                AFTER INSERT ON game_match DEFERRABLE INITIALLY DEFERRED
                FOR EACH ROW EXECUTE FUNCTION fail_match_insert()
                """.trimIndent(),
            )
            assertError(duel(player, key), 500, "INTERNAL_ERROR")
            assertEquals(0, countMatches())
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM challenger_progress", Int::class.java))
            assertEquals(0, jdbc.queryForObject("SELECT xp + wins + draws + losses FROM owned_player", Int::class.java))
        } finally {
            jdbc.execute("DROP TRIGGER IF EXISTS fail_match_insert ON game_match")
            jdbc.execute("DROP FUNCTION fail_match_insert()")
        }
        assertEquals(200, duel(player, key).statusCode())
        assertEquals(1, countMatches())
    }

    @Test
    fun `rewards remain historical after later matches and roster is scoped to session`() {
        val first = player()
        val second = player()
        val key = UUID.randomUUID()
        val original = json.readTree(duel(first, key).body())
        repeat(5) { assertEquals(200, duel(first).statusCode()) }
        assertEquals(original, json.readTree(duel(first, key).body()))
        val progress = jdbc.queryForMap("SELECT * FROM challenger_progress WHERE profile_id = ?", first.profileId)
        assertEquals(6, progress["attempts"])
        val response =
            first.client.send(
                HttpRequest.newBuilder(URI("http://localhost:$port/api/v1/roster")).GET().build(),
                HttpResponse.BodyHandlers.ofString(),
            )
        assertEquals(200, response.statusCode())
        val roster = json.readTree(response.body())
        assertEquals(1, roster.size())
        assertEquals(first.ownedId.toString(), roster.get(0).path("id").asString())
        assertEquals(
            0,
            jdbc.queryForObject("SELECT xp + wins + draws + losses FROM owned_player WHERE id = ?", Int::class.java, second.ownedId),
        )
        assertFailsWith<DataIntegrityViolationException> { jdbc.update("UPDATE challenger_progress SET attempts = -1") }
        assertFailsWith<DataIntegrityViolationException> { jdbc.update("UPDATE challenger_progress SET wins = wins + 1") }
    }

    @Test
    fun `level up is persisted and next duel uses effective stats without changing bases`() {
        val player = player()
        jdbc.update("UPDATE owned_player SET xp = 99 WHERE id = ?", player.ownedId)
        val first = json.readTree(duel(player).body()).path("rewards")
        assertEquals(1, first.path("previousLevel").asInt())
        assertEquals(2, first.path("currentLevel").asInt())
        assertEquals(99 + first.path("xpAwarded").asInt() - 100, first.path("currentXp").asInt())
        val atLevelTwo =
            json
                .readTree(duel(player).body())
                .path("match")
                .path("home")
                .get(0)
        assertEquals(2, atLevelTwo.path("level").asInt())
        assertEquals(75, atLevelTwo.path("stats").path("speed").asInt())
        jdbc.update("UPDATE owned_player SET level = 7, xp = 0 WHERE id = ?", player.ownedId)
        val next = json.readTree(duel(player).body())
        assertEquals(0, next.path("rewards").path("xpAwarded").asInt())
        assertEquals(
            80,
            next
                .path("match")
                .path("home")
                .get(0)
                .path("stats")
                .path("speed")
                .asInt(),
        )
        assertEquals(74, jdbc.queryForObject("SELECT speed FROM player_definition WHERE id = 'starter_leo'", Int::class.java))
    }

    @Test
    fun `concurrent distinct commands preserve every reward and progress count`() {
        val player = player()
        Executors.newFixedThreadPool(4).use { executor ->
            val futures = (1..4).map { executor.submit(Callable { duel(player) }) }
            futures.forEach { assertEquals(200, it.get(30, TimeUnit.SECONDS).statusCode()) }
        }
        assertEquals(4, countMatches())
        assertEquals(4, jdbc.queryForObject("SELECT attempts FROM challenger_progress", Int::class.java))
        assertEquals(4, jdbc.queryForObject("SELECT wins + draws + losses FROM owned_player", Int::class.java))
        val totalXp = jdbc.queryForObject("SELECT sum((rewards->>'xpAwarded')::integer)::integer FROM game_match", Int::class.java)!!
        val expected =
            com.streetfootball.game.progression.Progression
                .advance(1, 0, totalXp)
        assertEquals(expected.level, jdbc.queryForObject("SELECT level FROM owned_player", Int::class.java))
        assertEquals(expected.xp, jdbc.queryForObject("SELECT xp FROM owned_player", Int::class.java))
    }

    @Test
    fun `migrated Nilo is an introductory encounter for every starter and level two helps`() {
        fun participant(
            id: String,
            level: Int,
        ): MatchParticipant =
            jdbc.queryForObject(
                "SELECT * FROM player_definition WHERE id = ?",
                { row, _ ->
                    MatchParticipant(
                        id,
                        id,
                        row.getString("name"),
                        level,
                        Progression.effectiveStats(
                            MatchStats(
                                row.getInt("speed"),
                                row.getInt("dribbling"),
                                row.getInt("passing"),
                                row.getInt("finishing"),
                                row.getInt("defending"),
                                row.getInt("physical"),
                            ),
                            level,
                        ),
                    )
                },
                id,
            )
        val opponent = participant("npc_nilo_01", 1)
        val engine = DuelMatchEngine()
        val sampleSize = 20_000
        for (starterId in listOf("starter_leo", "starter_rafa", "starter_breno")) {
            val rates =
                (1..2).map { level ->
                    val starter = participant(starterId, level)
                    val counts = MatchOutcome.entries.associateWith { 0 }.toMutableMap()
                    repeat(sampleSize) { seed ->
                        val result =
                            engine.simulate(
                                MatchRequest(MatchMode.DUEL_1V1, listOf(starter), listOf(opponent), seed.toLong(), "1"),
                            )
                        counts[result.outcome] = counts.getValue(result.outcome) + 1
                    }
                    println("Intro balance $starterId level=$level samples=$sampleSize outcomes=$counts")
                    assertTrue(counts.getValue(MatchOutcome.LOSS) > 0)
                    assertTrue(counts.getValue(MatchOutcome.DRAW) > 0)
                    counts.getValue(MatchOutcome.WIN).toDouble() / sampleSize
                }
            // Current starter content gives Breno roughly 85% over this 20,000-seed sample.
            assertTrue(rates[0] in 0.70..0.85, "$starterId: ${rates[0]}")
            assertTrue(rates[1] > rates[0], "$starterId must benefit from the first level up")
        }
    }

    private fun player(): Player {
        val client = client()
        val profile = post(client, "/api/v1/profiles", """{"displayName":"Teste"}""")
        assertEquals(201, profile.statusCode())
        val starter = post(client, "/api/v1/profile/starter", """{"playerDefinitionId":"starter_leo"}""")
        assertEquals(200, starter.statusCode())
        return Player(
            client,
            UUID.fromString(json.readTree(profile.body()).path("id").asString()),
            UUID.fromString(json.readTree(starter.body()).path("id").asString()),
        )
    }

    @Test
    fun `HTTP method media type and missing route errors retain their status`() {
        val client = client()
        val matchUri = URI("http://localhost:$port/api/v1/challenges/$CHALLENGER_ID/matches")
        val requests =
            listOf(
                HttpRequest.newBuilder(matchUri).GET().build() to 405,
                HttpRequest
                    .newBuilder(matchUri)
                    .header("Content-Type", "text/plain")
                    .header("Idempotency-Key", UUID.randomUUID().toString())
                    .POST(HttpRequest.BodyPublishers.ofString("{}"))
                    .build() to 415,
                HttpRequest.newBuilder(URI("http://localhost:$port/api/v1/nonexistent")).GET().build() to 404,
            )
        for ((request, status) in requests) {
            assertError(client.send(request, HttpResponse.BodyHandlers.ofString()), status, "REQUEST_REJECTED")
        }
    }

    private fun client(): HttpClient = HttpClient.newBuilder().cookieHandler(CookieManager()).build()

    private fun duel(
        player: Player,
        key: UUID = UUID.randomUUID(),
        ownedId: UUID = player.ownedId,
        challengerId: UUID = CHALLENGER_ID,
    ) = post(player.client, "/api/v1/challenges/$challengerId/matches", """{"ownedPlayerId":"$ownedId"}""", key.toString())

    private fun post(
        client: HttpClient,
        path: String,
        body: String,
        key: String? = null,
    ): HttpResponse<String> {
        val request =
            HttpRequest
                .newBuilder(URI("http://localhost:$port$path"))
                .header("Content-Type", "application/json")
                .POST(HttpRequest.BodyPublishers.ofString(body))
        if (key != null) request.header("Idempotency-Key", key)
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString())
    }

    private fun assertError(
        response: HttpResponse<String>,
        status: Int,
        code: String,
    ) {
        assertEquals(status, response.statusCode(), response.body())
        val body: JsonNode = json.readTree(response.body())
        assertEquals(code, body.path("code").asString())
        assertTrue(body.path("traceId").asString().isNotBlank())
        assertTrue(!body.has("trace"))
    }

    private fun countMatches() = jdbc.queryForObject("SELECT count(*) FROM game_match", Int::class.java)

    private data class Player(
        val client: HttpClient,
        val profileId: UUID,
        val ownedId: UUID,
    )

    companion object {
        private val CHALLENGER_ID = UUID.fromString("00000000-0000-4000-8000-000000000001")
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
