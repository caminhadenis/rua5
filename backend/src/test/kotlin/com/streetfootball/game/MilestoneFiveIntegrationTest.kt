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
import com.streetfootball.game.recruitment.RecruitmentService
import org.flywaydb.core.Flyway
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
import org.springframework.jdbc.datasource.SingleConnectionDataSource
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
import java.util.concurrent.Executors
import java.util.concurrent.TimeUnit
import kotlin.test.assertEquals
import kotlin.test.assertFailsWith
import kotlin.test.assertFalse
import kotlin.test.assertTrue

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MilestoneFiveIntegrationTest {
    @LocalServerPort private var port = 0

    @Autowired private lateinit var jdbc: JdbcTemplate

    @Autowired private lateinit var json: ObjectMapper

    @Autowired private lateinit var recruitment: RecruitmentService

    @Autowired private lateinit var transactions: PlatformTransactionManager

    @Autowired private lateinit var engine: ControlledEngine
    private var outcome: MatchOutcome
        get() = engine.outcome
        set(value) {
            engine.outcome = value
        }

    @BeforeEach
    fun reset() {
        jdbc.update("DELETE FROM user_lineup")
        jdbc.update("DELETE FROM game_match")
        jdbc.update("DELETE FROM challenger_progress")
        jdbc.update("DELETE FROM owned_player")
        jdbc.update("DELETE FROM game_profile")
        jdbc.update("UPDATE challenger SET enabled = TRUE, map_id = 'benfica'")
        jdbc.update("UPDATE player_definition SET enabled = TRUE, recruitable = TRUE WHERE id = 'npc_nilo_01'")
        outcome = MatchOutcome.WIN
    }

    @TestConfiguration(proxyBeanMethods = false)
    class EngineConfig {
        @Bean @Primary
        fun controlledEngine() = ControlledEngine()
    }

    // Deterministic outcomes at the pure engine boundary; HTTP, services and PostgreSQL are real.
    class ControlledEngine : MatchEngine {
        var outcome = MatchOutcome.WIN

        override fun simulate(request: MatchRequest): MatchResult {
            val input = request
            val home = if (outcome == MatchOutcome.WIN) 1 else 0
            val away = if (outcome == MatchOutcome.LOSS) 1 else 0
            val side = if (outcome == MatchOutcome.LOSS) MatchSide.AWAY else MatchSide.HOME
            return MatchResult(
                home,
                away,
                outcome,
                listOf(
                    MatchEvent(
                        1,
                        1,
                        if (outcome == MatchOutcome.DRAW) MatchEventType.POSSESSION else MatchEventType.GOAL,
                        side,
                        (if (side == MatchSide.HOME) input.home else input.away).single().playerId,
                    ),
                ),
                MatchStatistics(SideStatistics(1, 0, 0, home, home), SideStatistics(1, 0, 0, away, away)),
                input.seed,
                input.engineVersion,
            )
        }
    }

    @Test
    fun `valid victory unlocks once and recruitment is stable after retries progression and rematches`() {
        val p = player()
        assertEquals("LOCKED", body(get(p, "/challenges/$NILO")).path("recruitmentStatus").asString())
        assertError(recruit(p), 409, "RECRUITMENT_NOT_AVAILABLE")
        for (result in listOf(MatchOutcome.DRAW, MatchOutcome.LOSS)) {
            outcome = result
            assertFalse(body(duel(p)).path("rewards").path("recruitmentUnlocked").asBoolean())
            assertError(recruit(p), 409, "RECRUITMENT_NOT_AVAILABLE")
        }
        outcome = MatchOutcome.WIN
        val key = UUID.randomUUID()
        val win = body(duel(p, key))
        assertTrue(win.path("rewards").path("recruitmentUnlocked").asBoolean())
        assertEquals("AVAILABLE", body(get(p, "/challenges/$NILO")).path("recruitmentStatus").asString())
        val recruited = body(recruit(p))
        val id = UUID.fromString(recruited.path("ownedPlayerId").asString())
        assertEquals(2, roster(p).size())
        assertEquals(1, jdbc.queryForObject("SELECT level FROM owned_player WHERE id = ?", Int::class.java, id))
        assertEquals(0, jdbc.queryForObject("SELECT xp + wins + draws + losses FROM owned_player WHERE id = ?", Int::class.java, id))
        assertEquals("RECRUITED", body(get(p, "/challenges/$NILO")).path("recruitmentStatus").asString())
        jdbc.update("UPDATE owned_player SET level = 4, xp = 20 WHERE id = ?", id)
        assertFalse(body(duel(p)).path("rewards").path("recruitmentUnlocked").asBoolean())
        assertEquals(win, body(duel(p, key)))
        jdbc.update("UPDATE challenger SET enabled = FALSE")
        assertEquals(recruited, body(recruit(p)))
        assertEquals(2, roster(p).size())
    }

    @Test
    fun `non recruitable victory and another profile cannot unlock recruitment`() {
        val p = player()
        val other = player()
        jdbc.update("UPDATE player_definition SET recruitable = FALSE WHERE id = 'npc_nilo_01'")
        assertFalse(body(duel(p)).path("rewards").path("recruitmentUnlocked").asBoolean())
        assertError(recruit(p), 409, "RECRUITMENT_NOT_AVAILABLE")
        jdbc.update("UPDATE player_definition SET recruitable = TRUE WHERE id = 'npc_nilo_01'")
        assertError(recruit(p), 409, "RECRUITMENT_NOT_AVAILABLE")
        duel(p)
        assertError(recruit(other), 409, "RECRUITMENT_NOT_AVAILABLE")
        assertError(
            send(other.client, "POST", "/challenges/$NILO/recruit", """{"profileId":"${p.profileId}","recruitmentStatus":"AVAILABLE"}"""),
            409,
            "RECRUITMENT_NOT_AVAILABLE",
        )
        assertEquals(1, roster(other).size())
        jdbc.update("UPDATE game_profile SET current_map_id = 'other' WHERE id = ?", p.profileId)
        assertError(recruit(p), 404, "CHALLENGER_NOT_AVAILABLE")
        assertError(send(client(), "POST", "/challenges/$NILO/recruit"), 404, "PROFILE_NOT_FOUND")
        assertError(send(p.client, "POST", "/challenges/${UUID.randomUUID()}/recruit"), 404, "CHALLENGER_NOT_AVAILABLE")
        assertError(send(p.client, "POST", "/challenges/bad/recruit"), 400, "MALFORMED_REQUEST")
    }

    @Test
    fun `concurrent recruitment grants exactly one owned player and equal responses`() {
        val p = player()
        duel(p)
        Executors.newFixedThreadPool(8).use { executor ->
            val results = (1..8).map { executor.submit(Callable { recruit(p) }) }.map { it.get(30, TimeUnit.SECONDS) }
            assertTrue(results.all { it.statusCode() == 200 })
            assertEquals(1, results.map { body(it) }.distinct().size)
        }
        assertEquals(2, roster(p).size())
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM game_match", Int::class.java))
    }

    @Test
    fun `recruitment rollback leaves available status and retry succeeds`() {
        val p = player()
        duel(p)
        assertFailsWith<IllegalStateException> {
            TransactionTemplate(transactions).execute {
                recruitment.recruit(p.profileId, NILO)
                error("failure after granting")
            }
        }
        assertEquals(1, roster(p).size())
        assertEquals("AVAILABLE", body(get(p, "/challenges/$NILO")).path("recruitmentStatus").asString())
        assertEquals(200, recruit(p).statusCode())
    }

    @Test
    fun `migration upgrades M4 wins without granting recruitment for legacy matches without rewards`() {
        val valid = player()
        val legacy = player()
        duel(valid)
        duel(legacy)
        jdbc.update("UPDATE game_match SET rewards = NULL WHERE profile_id = ?", legacy.profileId)
        val schema = "m5_upgrade"
        val before =
            Flyway
                .configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .schemas(schema)
                .defaultSchema(schema)
                .target("6")
                .load()
        before.migrate()
        postgres.createConnection("").use { connection ->
            connection.schema = schema
            val upgrade = JdbcTemplate(SingleConnectionDataSource(connection, true))
            for (table in listOf("game_profile", "owned_player", "game_match")) {
                val columns =
                    upgrade
                        .queryForList(
                            "SELECT column_name FROM information_schema.columns WHERE table_schema = ? AND table_name = ? ORDER BY ordinal_position",
                            String::class.java,
                            schema,
                            table,
                        ).joinToString(",")
                upgrade.update("INSERT INTO $table ($columns) SELECT $columns FROM public.$table")
            }
            upgrade.update(
                "INSERT INTO challenger_progress SELECT profile_id, challenger_id, attempts, wins, draws, losses, last_played_at FROM public.challenger_progress",
            )
            Flyway
                .configure()
                .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                .schemas(schema)
                .defaultSchema(schema)
                .load()
                .migrate()
            assertEquals(
                "AVAILABLE",
                upgrade.queryForObject(
                    "SELECT recruitment_status FROM challenger_progress WHERE profile_id = ?",
                    String::class.java,
                    valid.profileId,
                ),
            )
            assertEquals(
                "LOCKED",
                upgrade.queryForObject(
                    "SELECT recruitment_status FROM challenger_progress WHERE profile_id = ?",
                    String::class.java,
                    legacy.profileId,
                ),
            )
            assertEquals(
                20,
                upgrade.queryForObject("SELECT count(*) FROM flyway_schema_history WHERE success AND type = 'SQL'", Int::class.java),
            )
        }
    }

    @Test
    fun `recruited player can play duels and another challenger cannot duplicate its definition`() {
        val p = player()
        duel(p)
        val receipt = body(recruit(p))
        val id = receipt.path("ownedPlayerId").asString()
        assertEquals(
            200,
            send(p.client, "POST", "/challenges/$NILO/matches", """{"ownedPlayerId":"$id"}""", UUID.randomUUID()).statusCode(),
        )
        val alias = UUID.randomUUID()
        jdbc.update(
            "INSERT INTO challenger (id, player_definition_id, map_id, spawn_key, level) VALUES (?, 'npc_nilo_01', 'benfica', ?, 1)",
            alias,
            "fixture.$alias",
        )
        assertEquals(
            200,
            send(p.client, "POST", "/challenges/$alias/matches", """{"ownedPlayerId":"${p.ownedId}"}""", UUID.randomUUID()).statusCode(),
        )
        val second = body(send(p.client, "POST", "/challenges/$alias/recruit"))
        assertEquals(id, second.path("ownedPlayerId").asString())
        assertEquals(2, roster(p).size())
    }

    @Test
    fun `failed match transaction rolls back recruitment unlock and XP`() {
        val p = player()
        jdbc.execute("CREATE FUNCTION fail_m5_match() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''fail''; END;'")
        try {
            jdbc.execute(
                "CREATE CONSTRAINT TRIGGER fail_m5_match AFTER INSERT ON game_match DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_m5_match()",
            )
            assertError(duel(p), 500, "INTERNAL_ERROR")
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM challenger_progress", Int::class.java))
            assertEquals(0, jdbc.queryForObject("SELECT xp + wins FROM owned_player", Int::class.java))
            assertError(recruit(p), 409, "RECRUITMENT_NOT_AVAILABLE")
        } finally {
            jdbc.execute("DROP TRIGGER fail_m5_match ON game_match")
            jdbc.execute("DROP FUNCTION fail_m5_match()")
        }
        assertTrue(body(duel(p)).path("rewards").path("recruitmentUnlocked").asBoolean())
    }

    @Test
    fun `lineup saves empty partial and complete slots without duplicates or foreign ownership`() {
        val p = player()
        val other = player()
        assertEquals(List(5) { null }, lineup(p))
        val slots = listOf(p.ownedId, null, null, null, null)
        assertEquals(200, putLineup(p, slots).statusCode())
        assertEquals(slots.map { it?.toString() }, lineup(p))
        val full = fivePlayers(p)
        assertEquals(200, putLineup(p, full).statusCode())
        assertEquals(200, putLineup(p, full).statusCode())
        assertEquals(full.map { it.toString() }, lineup(p))
        assertError(putLineup(p, listOf(other.ownedId) + full.drop(1)), 403, "PLAYER_NOT_OWNED")
        assertError(putLineup(p, listOf(UUID.randomUUID()) + full.drop(1)), 403, "PLAYER_NOT_OWNED")
        assertError(putLineup(p, List(5) { p.ownedId }), 400, "INVALID_LINEUP")
        for (size in listOf(0, 4, 6)) assertError(putLineup(p, List(size) { null }), 400, "VALIDATION_ERROR")
        for (payload in listOf("{}", "{\"ownedPlayerIds\":null}", "{\"ownedPlayerIds\":[\"bad\",null,null,null,null]}")) {
            assertError(send(p.client, "PUT", "/lineup", payload), 400, "MALFORMED_REQUEST")
        }
        assertEquals(full.map { it.toString() }, lineup(p))
        assertEquals(List(5) { null }, lineup(other))
        assertEquals(1, roster(other).size())
        assertEquals(200, putLineup(p, full.reversed()).statusCode())
        assertEquals(full.reversed().map { it.toString() }, lineup(p))
        assertEquals(200, putLineup(p, List(5) { null }).statusCode())
        assertEquals(List(5) { null }, lineup(p))
    }

    @Test
    fun `database enforces slot range unique slots unique players ownership and one definition per profile`() {
        val p = player()
        val other = player()
        val ids = fivePlayers(p)

        fun insert(
            slot: Int,
            id: UUID,
        ) = jdbc.update("INSERT INTO user_lineup VALUES (?, ?, ?)", p.profileId, slot, id)
        insert(1, p.ownedId)
        assertFailsWith<DataIntegrityViolationException> { insert(0, ids[1]) }
        assertFailsWith<DataIntegrityViolationException> { insert(6, ids[1]) }
        assertFailsWith<DataIntegrityViolationException> { insert(1, ids[1]) }
        assertFailsWith<DataIntegrityViolationException> { insert(2, p.ownedId) }
        assertFailsWith<DataIntegrityViolationException> { insert(2, other.ownedId) }
        assertFailsWith<DataIntegrityViolationException> {
            jdbc.update(
                "INSERT INTO owned_player (id, profile_id, player_definition_id, recruited_at) VALUES (?, ?, 'starter_leo', now())",
                UUID.randomUUID(),
                p.profileId,
            )
        }
        duel(p)
        assertFailsWith<DataIntegrityViolationException> { jdbc.update("UPDATE challenger_progress SET recruitment_status = 'INVALID'") }
        assertFailsWith<DataIntegrityViolationException> {
            jdbc.update("UPDATE challenger_progress SET wins = 0, losses = 1, recruitment_status = 'AVAILABLE'")
        }
    }

    @Test
    fun `failed lineup replacement rolls back old slots and concurrent replacements never mix`() {
        val p = player()
        val full = fivePlayers(p)
        putLineup(p, full)
        jdbc.execute("CREATE FUNCTION fail_m5_lineup() RETURNS trigger LANGUAGE plpgsql AS 'BEGIN RAISE EXCEPTION ''fail''; END;'")
        try {
            jdbc.execute(
                "CREATE CONSTRAINT TRIGGER fail_m5_lineup AFTER INSERT ON user_lineup DEFERRABLE INITIALLY DEFERRED FOR EACH ROW EXECUTE FUNCTION fail_m5_lineup()",
            )
            assertError(putLineup(p, full.reversed()), 500, "INTERNAL_ERROR")
            assertEquals(full.map { it.toString() }, lineup(p))
        } finally {
            jdbc.execute("DROP TRIGGER fail_m5_lineup ON user_lineup")
            jdbc.execute("DROP FUNCTION fail_m5_lineup()")
        }
        Executors.newFixedThreadPool(4).use { executor ->
            val results = (0..3).map { index -> executor.submit(Callable { putLineup(p, if (index % 2 == 0) full else full.reversed()) }) }
            results.forEach { assertEquals(200, it.get(30, TimeUnit.SECONDS).statusCode()) }
        }
        assertTrue(lineup(p) in listOf(full, full.reversed()).map { ids -> ids.map { it.toString() } })
    }

    private fun fivePlayers(p: Player): List<UUID> {
        // Test-only roster content; production NPC expansion belongs to M7.
        val ids = mutableListOf(p.ownedId)
        for (index in 1..4) {
            val definition = "fixture_$index"
            jdbc.update(
                "INSERT INTO player_definition SELECT ?, ?, archetype, preferred_role, rarity, speed, dribbling, passing, finishing, defending, physical, TRUE, FALSE, TRUE FROM player_definition WHERE id = 'npc_nilo_01' ON CONFLICT DO NOTHING",
                definition,
                "Fixture $index",
            )
            val id = UUID.randomUUID()
            jdbc.update(
                "INSERT INTO owned_player (id, profile_id, player_definition_id, recruited_at) VALUES (?, ?, ?, now())",
                id,
                p.profileId,
                definition,
            )
            ids.add(id)
        }
        return ids
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
