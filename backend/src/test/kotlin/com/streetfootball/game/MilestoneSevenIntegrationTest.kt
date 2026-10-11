package com.streetfootball.game

import com.streetfootball.game.match.domain.MatchMode
import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchRequest
import com.streetfootball.game.match.domain.VersionedMatchEngine
import com.streetfootball.game.match.snapshot
import com.streetfootball.game.roster.PlayerDefinitionRepository
import org.flywaydb.core.Flyway
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.jdbc.datasource.SingleConnectionDataSource
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
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MilestoneSevenIntegrationTest {
    @LocalServerPort private var port = 0

    @Autowired private lateinit var jdbc: JdbcTemplate

    @Autowired private lateinit var json: ObjectMapper

    @Autowired private lateinit var definitions: PlayerDefinitionRepository

    @Test
    fun `five attribute migration upgrades legacy saves without changing results or stadium order`() {
        val schema = "attribute_upgrade_${UUID.randomUUID().toString().replace("-", "")}"

        fun flyway(target: String? = null): Flyway {
            val config =
                Flyway
                    .configure()
                    .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                    .schemas(schema)
                    .defaultSchema(schema)
            if (target != null) config.target(target)
            return config.load()
        }
        flyway("20").migrate()
        postgres.createConnection("").use { connection ->
            connection.schema = schema
            val upgrade = JdbcTemplate(SingleConnectionDataSource(connection, true))
            val profileId = UUID.randomUUID()
            val playerId = UUID.randomUUID()
            val matchId = UUID.randomUUID()
            val key = UUID.randomUUID()
            val seriesId = UUID.randomUUID()
            upgrade.update(
                "INSERT INTO game_profile (id, display_name, created_at, updated_at) VALUES (?, 'Upgrade', now(), now())",
                profileId,
            )
            upgrade.update(
                """INSERT INTO owned_player (id, profile_id, player_definition_id, level, xp, recruited_at,
                   training_dribbling, training_passing) VALUES (?, ?, 'starter_leo', 3, 42, now(), 7, 12)""",
                playerId,
                profileId,
            )
            for (focus in listOf("PASSING", "DRIBBLING")) {
                upgrade.update(
                    """INSERT INTO training_session (profile_id, idempotency_key, owned_player_id, focus, xp_awarded,
                       previous_level, current_level, previous_xp, current_xp, trained_at)
                       VALUES (?, ?, ?, ?, 8, 3, 3, 34, 42, now())""",
                    profileId,
                    UUID.randomUUID(),
                    playerId,
                    focus,
                )
                upgrade.update(
                    "INSERT INTO owned_player_training_progress VALUES (?, ?, 2)",
                    playerId,
                    focus,
                )
            }

            fun participants(prefix: String) =
                (1..5).map { index ->
                    mapOf(
                        "playerId" to "$prefix$index",
                        "playerDefinitionId" to "$prefix$index",
                        "name" to "$prefix$index",
                        "level" to 3,
                        "stats" to
                            mapOf(
                                "speed" to 50,
                                "dribbling" to 51.75,
                                "passing" to 53,
                                "finishing" to 50,
                                "defending" to 50,
                                "physical" to 50,
                            ),
                    )
                }
            val home = participants("home")
            val away = participants("away")
            val snapshot =
                json.writeValueAsString(
                    mapOf("mode" to "STADIUM_5V5", "home" to home, "away" to away, "seed" to 42, "engineVersion" to "2"),
                )
            val events =
                json.writeValueAsString(
                    listOf("POSSESSION", "PASS", "SHOT", "GOAL").mapIndexed { index, type ->
                        mapOf("sequence" to index + 1, "minute" to 1, "type" to type, "side" to "HOME", "actorPlayerId" to "home1")
                    },
                )
            val statistics = """{"home":{"possessions":1,"successfulDribbles":0,"tackles":0,"shots":1,"goals":1},
                "away":{"possessions":0,"successfulDribbles":0,"tackles":0,"shots":0,"goals":0}}"""
            upgrade.update(
                """INSERT INTO game_match (id, profile_id, mode, source_type, stadium_id, home_score, away_score,
                   outcome, seed, engine_version, request_snapshot, events, statistics, idempotency_key, created_at)
                   VALUES (?, ?, 'STADIUM_5V5', 'STADIUM', 'benfica_stadium', 1, 0, 'WIN', 42, '2',
                   ?::jsonb, ?::jsonb, ?::jsonb, ?, now())""",
                matchId,
                profileId,
                snapshot,
                events,
                statistics,
                key,
            )
            upgrade.update(
                "INSERT INTO user_trophy (profile_id, trophy_id, stadium_id, match_id, won_at) VALUES (?, 'trophy_benfica', 'benfica_stadium', ?, now())",
                profileId,
                matchId,
            )
            upgrade.update(
                "INSERT INTO stadium_series (id, profile_id, stadium_id, opponents, played, wins, created_at) VALUES (?, ?, 'benfica_stadium', ?::jsonb, 2, 2, now())",
                seriesId,
                profileId,
                json.writeValueAsString(away),
            )
            flyway().migrate()
            assertEquals(
                0,
                upgrade.queryForObject(
                    "SELECT count(*) FROM information_schema.columns WHERE table_schema = ? AND column_name IN ('passing', 'training_passing')",
                    Int::class.java,
                    schema,
                ),
            )
            assertEquals(175, upgrade.queryForObject("SELECT training_dribbling FROM owned_player WHERE id = ?", Int::class.java, playerId))
            assertEquals(42, upgrade.queryForObject("SELECT xp FROM owned_player WHERE id = ?", Int::class.java, playerId))
            assertEquals(3, upgrade.queryForObject("SELECT level FROM owned_player WHERE id = ?", Int::class.java, playerId))
            assertEquals(listOf("DRIBBLING"), upgrade.queryForList("SELECT focus FROM training_session", String::class.java))
            assertEquals(listOf("DRIBBLING"), upgrade.queryForList("SELECT focus FROM owned_player_training_progress", String::class.java))
            val stored =
                requireNotNull(
                    com.streetfootball.game.match
                        .MatchRepository(upgrade, json)
                        .findByKey(profileId, key),
                )
            assertEquals(1, stored.result.homeScore)
            assertEquals(0, stored.result.awayScore)
            assertEquals("2", stored.result.engineVersion)
            assertEquals(MatchOutcome.WIN, stored.result.outcome)
            assertEquals(listOf("POSSESSION", "SHOT", "GOAL"), stored.result.events.map { it.type.name })
            assertEquals(listOf(1, 2, 3), stored.result.events.map { it.sequence })
            assertEquals(
                51.75,
                stored.request.home
                    .first()
                    .stats.dribbling,
            )
            assertEquals(json.readTree(statistics), json.readTree(json.writeValueAsString(stored.result.statistics)))
            assertEquals(1, upgrade.queryForObject("SELECT count(*) FROM user_trophy WHERE match_id = ?", Int::class.java, matchId))
            val series =
                requireNotNull(
                    com.streetfootball.game.stadium
                        .StadiumSeriesRepository(upgrade, json)
                        .latest(profileId, "benfica_stadium"),
                )
            assertEquals(seriesId, series.id)
            assertEquals(2, series.played)
            assertEquals(2, series.wins)
            assertEquals((1..5).map { "away$it" }, series.opponents.map { it.playerId })
            kotlin.test.assertFailsWith<IllegalArgumentException> { VersionedMatchEngine().simulate(stored.request) }
        }
    }

    @Test
    fun `quarter point migration preserves earned bonuses and historical receipts`() {
        val schema = "training_upgrade_${UUID.randomUUID().toString().replace("-", "")}"

        fun flyway(target: String? = null): Flyway {
            val config =
                Flyway
                    .configure()
                    .dataSource(postgres.jdbcUrl, postgres.username, postgres.password)
                    .schemas(schema)
                    .defaultSchema(schema)
            if (target != null) config.target(target)
            return config.load()
        }
        flyway("19").migrate()
        postgres.createConnection("").use { connection ->
            connection.schema = schema
            val upgrade = JdbcTemplate(SingleConnectionDataSource(connection, true))
            val profileId = UUID.randomUUID()
            val playerId = UUID.randomUUID()
            upgrade.update(
                "INSERT INTO game_profile (id, display_name, created_at, updated_at) VALUES (?, 'Upgrade', now(), now())",
                profileId,
            )
            upgrade.update(
                """INSERT INTO owned_player (id, profile_id, player_definition_id, recruited_at,
                   training_speed, training_dribbling, training_physical) VALUES (?, ?, 'starter_leo', now(), 2, 3, 98)""",
                playerId,
                profileId,
            )
            upgrade.update(
                """INSERT INTO training_session (profile_id, idempotency_key, owned_player_id, focus, xp_awarded,
                   previous_level, current_level, previous_xp, current_xp, trained_at, stat_before, stat_after,
                   progress_before, progress_after) VALUES (?, ?, ?, 'DRIBBLING', 0, 1, 1, 0, 0, now(), 73, 73, 1, 2)""",
                profileId,
                UUID.randomUUID(),
                playerId,
            )
            flyway().migrate()
            for ((stat, hundredths) in listOf("speed" to 200, "dribbling" to 300, "physical" to 9800)) {
                assertEquals(
                    hundredths,
                    upgrade.queryForObject("SELECT training_$stat FROM owned_player WHERE id = ?", Int::class.java, playerId),
                )
            }
            assertEquals(73.0, upgrade.queryForObject("SELECT stat_after FROM training_session", Double::class.java))
            assertEquals(2, upgrade.queryForObject("SELECT progress_after FROM training_session", Int::class.java))
        }
    }

    @Test
    fun `every starter completes the neighborhood through HTTP without save fixtures`() {
        val challengers = jdbc.queryForList("SELECT id::text FROM challenger WHERE enabled ORDER BY spawn_key", String::class.java)
        assertEquals(16, challengers.size)
        assertEquals(listOf("benfica"), jdbc.queryForList("SELECT DISTINCT map_id FROM challenger", String::class.java))
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM stadium", Int::class.java))
        for (starter in listOf("starter_leo", "starter_rafa", "starter_breno")) {
            val client = HttpClient.newBuilder().cookieHandler(CookieManager()).build()
            val profile = body(send(client, "POST", "/profiles", mapOf("displayName" to "M7 $starter")))
            val profileId = UUID.fromString(profile["id"].asString())
            val chosen = body(send(client, "POST", "/profile/starter", mapOf("playerDefinitionId" to starter)))
            assertEquals(chosen["id"], body(send(client, "POST", "/profile/starter", mapOf("playerDefinitionId" to starter)))["id"])
            assertEquals(1, body(send(client, "GET", "/roster")).size())
            var matchCount = 0

            fun win(
                path: String,
                payload: Any = emptyMap<String, String>(),
            ): JsonNode {
                for (attempt in 1..30) {
                    val key = UUID.randomUUID()
                    val result = body(send(client, "POST", path, payload, key))
                    matchCount++
                    val roster = body(send(client, "GET", "/roster"))
                    assertEquals(result, body(send(client, "POST", path, payload, key)))
                    assertEquals(persistentRoster(roster), persistentRoster(body(send(client, "GET", "/roster"))))
                    if (result["match"]["outcome"].asString() == "WIN") return result
                }
                error("$starter could not win $path within 30 attempts")
            }
            val preferred = setOf(starter, "npc_rui_01", "npc_sol_01", "npc_teca_01", "npc_zeca_01")
            val desiredChallengers = (5..8).map { "00000000-0000-4000-8000-${it.toString().padStart(12, '0')}" }.toSet()
            for (challenger in challengers) {
                win("/challenges/$challenger/matches", mapOf("ownedPlayerId" to chosen["id"].asString()))
                if (challenger !in desiredChallengers) continue
                val path = "/challenges/$challenger/recruit"
                val recruited = body(send(client, "POST", path))
                assertEquals(recruited, body(send(client, "POST", path)))
            }
            val roster = body(send(client, "GET", "/roster"))
            assertEquals(5, roster.size())
            val ids = roster.filter { it["playerDefinitionId"].asString() in preferred }.map { it["id"].asString() }
            body(send(client, "PUT", "/lineup", mapOf("ownedPlayerIds" to ids.take(4) + null)))
            val stadium = "/stadiums/benfica_stadium"
            assertEquals("AVAILABLE", body(send(client, "GET", stadium))["status"].asString())
            body(send(client, "PUT", "/lineup", mapOf("ownedPlayerIds" to ids)))
            // This smoke verifies HTTP progression, not luck across a thousand exhausted duels.
            // Prepare each starter through real training commands; balance is tested separately.
            for (focus in listOf("SPEED", "DRIBBLING", "FINISHING", "DEFENDING", "PHYSICAL")) {
                var stat = body(send(client, "GET", "/roster")).first { it["id"] == chosen["id"] }["stats"][focus.lowercase()].asDouble()
                while (stat < 99.0) {
                    val trained =
                        body(
                            send(
                                client,
                                "POST",
                                "/training/sessions",
                                mapOf(
                                    "ownedPlayerId" to chosen["id"].asString(),
                                    "focus" to focus,
                                ),
                                UUID.randomUUID(),
                            ),
                        )
                    stat = trained["statAfter"].asDouble()
                }
            }
            var trophyWon = false
            for (duel in 1..1000) {
                val info = body(send(client, "GET", stadium))
                val series = info["series"]
                val payload =
                    mapOf(
                        "ownedPlayerId" to chosen["id"].asString(),
                        "seriesId" to if (series.isNull) null else series["id"].asString(),
                        "roundNumber" to if (series.isNull || series["finished"].asBoolean()) 1 else series["played"].asInt() + 1,
                    )
                val key = UUID.randomUUID()
                val receipt = body(send(client, "POST", "$stadium/matches", payload, key))
                matchCount++
                assertEquals(receipt, body(send(client, "POST", "$stadium/matches", payload, key)))
                if (!receipt["rewards"]["trophy"].isNull) {
                    trophyWon = true
                    break
                }
            }
            assertTrue(trophyWon, "$starter must complete five consecutive stadium duels")
            assertEquals("COMPLETED", body(send(client, "GET", stadium))["status"].asString())
            val blocked =
                send(
                    client,
                    "POST",
                    "$stadium/matches",
                    mapOf("ownedPlayerId" to chosen["id"].asString(), "roundNumber" to 1),
                    UUID.randomUUID(),
                )
            assertEquals(409, blocked.statusCode())
            assertEquals("STADIUM_ALREADY_COMPLETED", json.readTree(blocked.body())["code"].asString())
            assertEquals(
                matchCount,
                jdbc.queryForObject("SELECT count(*) FROM game_match WHERE profile_id = ?", Int::class.java, profileId),
            )
            assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_trophy WHERE profile_id = ?", Int::class.java, profileId))
        }
    }

    @Test
    fun `training improves stat every session without XP or levels and without a wait`() {
        val client = HttpClient.newBuilder().cookieHandler(CookieManager()).build()
        val profileId = body(send(client, "POST", "/profiles", mapOf("displayName" to "Treino")))["id"].asString()
        val starter = body(send(client, "POST", "/profile/starter", mapOf("playerDefinitionId" to "starter_leo")))
        val playerId = starter["id"].asString()
        val path = "/training/sessions"
        val payload = mapOf("ownedPlayerId" to playerId, "focus" to "DRIBBLING")
        val key = UUID.randomUUID()
        val before = body(send(client, "GET", "/roster"))[0]
        assertEquals(5, before["stats"].size())
        assertEquals(400, send(client, "POST", path, payload + ("focus" to "PASSING"), UUID.randomUUID()).statusCode())
        // A partial group from an old save must not delay or multiply the new quarter-point gain.
        jdbc.update(
            "INSERT INTO owned_player_training_progress (owned_player_id, focus, sessions_completed) VALUES (?, 'DRIBBLING', 3)",
            UUID.fromString(playerId),
        )
        val first = body(send(client, "POST", path, payload, key))
        assertEquals(0, first["xpAwarded"].asInt())
        assertEquals(before["stats"]["dribbling"].asDouble(), first["statBefore"].asDouble())
        assertEquals(first["statBefore"].asDouble() + 0.25, first["statAfter"].asDouble())
        assertEquals(3, first["progressBefore"].asInt())
        assertEquals(0, first["progressAfter"].asInt())
        assertEquals(first, body(send(client, "POST", path, payload, key)))
        val after = body(send(client, "GET", "/roster"))[0]
        assertEquals(before["xp"], after["xp"])
        assertEquals(before["level"], after["level"])
        assertEquals(first["statAfter"], after["stats"]["dribbling"])
        assertEquals(before["stats"]["finishing"], after["stats"]["finishing"])
        val status = body(send(client, "GET", "/training/status"))
        assertEquals(0, status["cooldowns"].size())
        assertEquals(0, status["progress"][0]["completed"].asInt())
        assertEquals(
            1,
            jdbc.queryForObject(
                "SELECT count(*) FROM training_session WHERE owned_player_id = ?",
                Int::class.java,
                UUID.fromString(playerId),
            ),
        )
        val secondPlayer = UUID.randomUUID()
        jdbc.update(
            "INSERT INTO owned_player (id, profile_id, player_definition_id, recruited_at) VALUES (?, ?, ?, now())",
            secondPlayer,
            UUID.fromString(profileId),
            "starter_rafa",
        )
        val secondAthlete =
            body(
                send(
                    client,
                    "POST",
                    path,
                    mapOf("ownedPlayerId" to secondPlayer.toString(), "focus" to "SPEED"),
                    UUID.randomUUID(),
                ),
            )
        assertEquals(0, secondAthlete["progressBefore"].asInt())
        assertEquals(0, secondAthlete["progressAfter"].asInt())
        assertEquals(secondAthlete["statBefore"].asDouble() + 0.25, secondAthlete["statAfter"].asDouble())
        assertEquals(0, body(send(client, "GET", "/training/status"))["cooldowns"].size())
        assertEquals(409, send(client, "POST", path, payload + ("focus" to "FINISHING"), key).statusCode())
        val other = HttpClient.newBuilder().cookieHandler(CookieManager()).build()
        body(send(other, "POST", "/profiles", mapOf("displayName" to "Outro")))
        body(send(other, "POST", "/profile/starter", mapOf("playerDefinitionId" to "starter_rafa")))
        assertEquals(403, send(other, "POST", path, payload, UUID.randomUUID()).statusCode())
        assertEquals(400, send(client, "POST", path, payload + ("focus" to "GOALKEEPING"), UUID.randomUUID()).statusCode())
        var latest = first
        for (session in 2..5) {
            latest = body(send(client, "POST", path, payload, UUID.randomUUID()))
            assertEquals(0, latest["progressAfter"].asInt())
            val gain = if (session <= 3) 0.25 else 0.20
            assertEquals(gain, latest["statAfter"].asDouble() - latest["statBefore"].asDouble(), 0.000001)
            assertEquals(before["level"], latest["currentLevel"])
            assertEquals(before["xp"], latest["currentXp"])
        }
        assertEquals(
            5,
            jdbc.queryForObject(
                "SELECT count(*) FROM training_session WHERE owned_player_id = ?",
                Int::class.java,
                UUID.fromString(playerId),
            ),
        )
        val playerProgress =
            body(send(client, "GET", "/training/status"))["progress"]
                .first { it["ownedPlayerId"].asString() == playerId && it["focus"].asString() == "DRIBBLING" }
        assertEquals(0, playerProgress["completed"].asInt())
        val otherFocus = body(send(client, "POST", path, payload + ("focus" to "FINISHING"), UUID.randomUUID()))
        assertEquals(0, otherFocus["progressBefore"].asInt())
        assertEquals(0, otherFocus["progressAfter"].asInt())
        assertEquals(otherFocus["statBefore"].asDouble() + 0.20, otherFocus["statAfter"].asDouble(), 0.000001)
        val otherAthlete =
            body(send(client, "POST", path, mapOf("ownedPlayerId" to secondPlayer.toString(), "focus" to "DRIBBLING"), UUID.randomUUID()))
        assertEquals(0, otherAthlete["progressBefore"].asInt())
        assertEquals(0, otherAthlete["progressAfter"].asInt())
        assertEquals(otherAthlete["statBefore"].asDouble() + 0.25, otherAthlete["statAfter"].asDouble())
        val duel =
            body(
                send(
                    client,
                    "POST",
                    "/challenges/00000000-0000-4000-8000-000000000001/matches",
                    mapOf("ownedPlayerId" to playerId),
                    UUID.randomUUID(),
                ),
            )
        assertEquals(
            latest["statAfter"].asDouble() * (1 - duel["rewards"]["fatigue"]["before"]["penaltyPercent"].asInt() / 100.0),
            duel["match"]["home"][0]["stats"]["dribbling"].asDouble(),
        )
        val cappedPayload = mapOf("ownedPlayerId" to secondPlayer.toString(), "focus" to "DRIBBLING")
        val baseDribbling = definitions.findById("starter_rafa").orElseThrow().dribbling
        jdbc.update("UPDATE owned_player SET training_dribbling = ? WHERE id = ?", (99 - baseDribbling) * 100 - 5, secondPlayer)
        val capKey = UUID.randomUUID()
        val capped = body(send(client, "POST", path, cappedPayload, capKey))
        assertEquals(98.95, capped["statBefore"].asDouble())
        assertEquals(99.0, capped["statAfter"].asDouble())
        val maxed = send(client, "POST", path, cappedPayload, UUID.randomUUID())
        assertEquals(409, maxed.statusCode())
        assertEquals("TRAINING_STAT_MAX", json.readTree(maxed.body())["code"].asString())
        // The original first receipt survives later sessions and matches without another gain.
        val currentRoster = body(send(client, "GET", "/roster"))
        val retried = body(send(client, "POST", path, payload, key))
        for (field in listOf("statBefore", "statAfter", "progressBefore", "progressAfter", "currentLevel", "currentXp")) {
            assertEquals(first[field], retried[field])
        }
        assertEquals(persistentRoster(currentRoster), persistentRoster(body(send(client, "GET", "/roster"))))
    }

    @Test
    fun `production content gives viable starters and rewards exploring stronger recruits`() {
        val engine = VersionedMatchEngine()

        fun participant(
            id: String,
            level: Int,
            side: String = "home",
        ) = definitions.findById(id).orElseThrow().snapshot("$side-$id", level)
        val away =
            jdbc.query("SELECT player_definition_id, level FROM stadium_opponent_player ORDER BY slot_index", { row, _ ->
                participant(row.getString("player_definition_id"), row.getInt("level"), "away")
            })
        val challengeLevels =
            jdbc
                .query("SELECT player_definition_id, level FROM challenger", { row, _ ->
                    row.getString("player_definition_id") to row.getInt("level")
                })
                .toMap()
        assertEquals(
            listOf(1, 1, 1, 2, 2, 3, 4, 5, 2, 1, 3, 2, 2, 1, 3, 4),
            jdbc.queryForList("SELECT level FROM challenger ORDER BY spawn_key", Int::class.java),
        )

        fun rate(request: MatchRequest): Double =
            (0L until 2000L).count { seed -> engine.simulate(request.copy(seed = seed)).outcome == MatchOutcome.WIN } / 2000.0
        for (starter in listOf("starter_leo", "starter_rafa", "starter_breno")) {
            val intro =
                rate(
                    MatchRequest(
                        MatchMode.DUEL_1V1,
                        listOf(participant(starter, 1)),
                        listOf(participant("npc_nilo_01", 1, "away")),
                        0,
                        "1",
                    ),
                )

            fun seriesRate(level: Int): Double =
                (0L until 2000L).count { seed ->
                    away.withIndex().all { (round, opponent) ->
                        engine
                            .simulate(
                                MatchRequest(
                                    MatchMode.STADIUM_1V1,
                                    listOf(participant(starter, level)),
                                    listOf(opponent),
                                    seed * 5 + round,
                                    "3",
                                ),
                            ).outcome == MatchOutcome.WIN
                    }
                } / 2000.0
            val early = seriesRate(1)
            for (opponent in listOf("npc_cora_01", "npc_davi_01", "npc_bia_01")) {
                val firstDuel =
                    rate(
                        MatchRequest(
                            MatchMode.DUEL_1V1,
                            listOf(participant(starter, 1)),
                            listOf(participant(opponent, challengeLevels.getValue(opponent), "away")),
                            0,
                            "1",
                        ),
                    )
                val minimum = if (opponent == "npc_bia_01") 0.55 else 0.60
                assertTrue(firstDuel > minimum, "$starter needs a fair opening against $opponent: $firstDuel")
            }
            val explored = seriesRate(10)
            println("M7 balance $starter: intro=$intro firstStadiumSeries=$early evolvedStadiumSeries=$explored")
            assertTrue(intro in 0.68..0.85)
            assertTrue(early > 0.0, "Every starter can win the five duels")
            assertTrue(explored > early + 0.02, "Evolution must improve the chance of completing the series")
        }
    }

    private fun send(
        client: HttpClient,
        method: String,
        path: String,
        payload: Any = emptyMap<String, String>(),
        key: UUID? = null,
    ): HttpResponse<String> {
        val builder = HttpRequest.newBuilder(URI("http://localhost:$port/api/v1$path")).header("Content-Type", "application/json")
        if (key != null) builder.header("Idempotency-Key", key.toString())
        builder.method(
            method,
            if (method ==
                "GET"
            ) {
                HttpRequest.BodyPublishers.noBody()
            } else {
                HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload))
            },
        )
        return client.send(builder.build(), HttpResponse.BodyHandlers.ofString())
    }

    private fun body(response: HttpResponse<String>): JsonNode {
        assertTrue(response.statusCode() in 200..299, response.body())
        return json.readTree(response.body())
    }

    companion object {
        private val postgres = PostgreSQLContainer("postgres:18.6-alpine").apply { start() }

        @JvmStatic @DynamicPropertySource
        fun database(registry: DynamicPropertyRegistry) {
            registry.add("spring.datasource.url", postgres::getJdbcUrl)
            registry.add("spring.datasource.username", postgres::getUsername)
            registry.add("spring.datasource.password", postgres::getPassword)
        }
    }
}
