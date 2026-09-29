package com.streetfootball.game

import com.streetfootball.game.match.domain.MatchMode
import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchRequest
import com.streetfootball.game.match.domain.VersionedMatchEngine
import com.streetfootball.game.match.snapshot
import com.streetfootball.game.roster.PlayerDefinitionRepository
import org.junit.jupiter.api.Test
import org.springframework.beans.factory.annotation.Autowired
import org.springframework.boot.test.context.SpringBootTest
import org.springframework.boot.test.web.server.LocalServerPort
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
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class MilestoneSevenIntegrationTest {
    @LocalServerPort private var port = 0

    @Autowired private lateinit var jdbc: JdbcTemplate

    @Autowired private lateinit var json: ObjectMapper

    @Autowired private lateinit var definitions: PlayerDefinitionRepository

    @Test
    fun `every starter completes the neighborhood through HTTP without save fixtures`() {
        val challengers = jdbc.queryForList("SELECT id::text FROM challenger WHERE enabled ORDER BY spawn_key", String::class.java)
        assertEquals(8, challengers.size)
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
                    assertEquals(roster, body(send(client, "GET", "/roster")))
                    if (result["match"]["outcome"].asString() == "WIN") return result
                }
                error("$starter could not win $path within 30 attempts")
            }
            for (challenger in challengers) {
                win("/challenges/$challenger/matches", mapOf("ownedPlayerId" to chosen["id"].asString()))
                val path = "/challenges/$challenger/recruit"
                val recruited = body(send(client, "POST", path))
                assertEquals(recruited, body(send(client, "POST", path)))
            }
            val roster = body(send(client, "GET", "/roster"))
            assertEquals(9, roster.size())
            val preferred = setOf(starter, "npc_rui_01", "npc_sol_01", "npc_teca_01", "npc_zeca_01")
            val ids = roster.filter { it["playerDefinitionId"].asString() in preferred }.map { it["id"].asString() }
            body(send(client, "PUT", "/lineup", mapOf("ownedPlayerIds" to ids.take(4) + null)))
            val stadium = "/stadiums/benfica_stadium"
            assertEquals(409, send(client, "POST", "$stadium/matches", key = UUID.randomUUID()).statusCode())
            body(send(client, "PUT", "/lineup", mapOf("ownedPlayerIds" to ids)))
            assertEquals("trophy_benfica", win("$stadium/matches")["rewards"]["trophy"]["id"].asString())
            assertEquals("COMPLETED", body(send(client, "GET", stadium))["status"].asString())
            val blocked = send(client, "POST", "$stadium/matches", key = UUID.randomUUID())
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
    fun `training improves stat only every fifth session and is owned idempotent and profile rate limited`() {
        val client = HttpClient.newBuilder().cookieHandler(CookieManager()).build()
        val profileId = body(send(client, "POST", "/profiles", mapOf("displayName" to "Treino")))["id"].asString()
        val starter = body(send(client, "POST", "/profile/starter", mapOf("playerDefinitionId" to "starter_leo")))
        val playerId = starter["id"].asString()
        val path = "/training/sessions"
        val payload = mapOf("ownedPlayerId" to playerId, "focus" to "DRIBBLING")
        val key = UUID.randomUUID()
        val before = body(send(client, "GET", "/roster"))[0]
        val first = body(send(client, "POST", path, payload, key))
        assertEquals(0, first["xpAwarded"].asInt())
        assertEquals(before["stats"]["dribbling"].asInt(), first["statBefore"].asInt())
        assertEquals(first["statBefore"], first["statAfter"])
        assertEquals(0, first["progressBefore"].asInt())
        assertEquals(1, first["progressAfter"].asInt())
        assertEquals(first, body(send(client, "POST", path, payload, key)))
        val after = body(send(client, "GET", "/roster"))[0]
        assertEquals(before["xp"], after["xp"])
        assertEquals(first["statAfter"], after["stats"]["dribbling"])
        assertEquals(before["stats"]["passing"], after["stats"]["passing"])
        val status = body(send(client, "GET", "/training/status"))
        assertEquals(first["nextAvailableAt"], status["nextAvailableAt"])
        assertEquals(1, status["progress"][0]["completed"].asInt())
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM training_session WHERE owned_player_id = ?", Int::class.java, UUID.fromString(playerId)))
        val cooldown = send(client, "POST", path, payload, UUID.randomUUID())
        assertEquals(409, cooldown.statusCode())
        assertEquals("TRAINING_COOLDOWN", json.readTree(cooldown.body())["code"].asString())
        val secondPlayer = UUID.randomUUID()
        jdbc.update("INSERT INTO owned_player (id, profile_id, player_definition_id, recruited_at) VALUES (?, ?, ?, now())", secondPlayer, UUID.fromString(profileId), "starter_rafa")
        assertEquals(409, send(client, "POST", path, mapOf("ownedPlayerId" to secondPlayer.toString(), "focus" to "SPEED"), UUID.randomUUID()).statusCode())
        assertEquals(409, send(client, "POST", path, payload + ("focus" to "PASSING"), key).statusCode())
        val other = HttpClient.newBuilder().cookieHandler(CookieManager()).build()
        body(send(other, "POST", "/profiles", mapOf("displayName" to "Outro")))
        body(send(other, "POST", "/profile/starter", mapOf("playerDefinitionId" to "starter_rafa")))
        assertEquals(403, send(other, "POST", path, payload, UUID.randomUUID()).statusCode())
        assertEquals(400, send(client, "POST", path, payload + ("focus" to "GOALKEEPING"), UUID.randomUUID()).statusCode())
        var latest = first
        for (session in 2..5) {
            jdbc.update("UPDATE training_session SET trained_at = now() - interval '61 seconds' WHERE profile_id = ?", UUID.fromString(profileId))
            latest = body(send(client, "POST", path, payload, UUID.randomUUID()))
            assertEquals((session % 5), latest["progressAfter"].asInt())
            assertEquals(before["stats"]["dribbling"].asInt() + if (session == 5) 1 else 0, latest["statAfter"].asInt())
        }
        assertEquals(5, jdbc.queryForObject("SELECT count(*) FROM training_session WHERE owned_player_id = ?", Int::class.java, UUID.fromString(playerId)))
        assertEquals(0, body(send(client, "GET", "/training/status"))["progress"][0]["completed"].asInt())
        jdbc.update("UPDATE training_session SET trained_at = now() - interval '61 seconds' WHERE profile_id = ?", UUID.fromString(profileId))
        val otherFocus = body(send(client, "POST", path, payload + ("focus" to "PASSING"), UUID.randomUUID()))
        assertEquals(0, otherFocus["progressBefore"].asInt())
        assertEquals(1, otherFocus["progressAfter"].asInt())
        assertEquals(otherFocus["statBefore"], otherFocus["statAfter"])
        jdbc.update("UPDATE training_session SET trained_at = now() - interval '61 seconds' WHERE profile_id = ?", UUID.fromString(profileId))
        val otherAthlete = body(send(client, "POST", path, mapOf("ownedPlayerId" to secondPlayer.toString(), "focus" to "DRIBBLING"), UUID.randomUUID()))
        assertEquals(0, otherAthlete["progressBefore"].asInt())
        assertEquals(1, otherAthlete["progressAfter"].asInt())
        assertEquals(otherAthlete["statBefore"], otherAthlete["statAfter"])
        val duel = body(send(client, "POST", "/challenges/00000000-0000-4000-8000-000000000001/matches", mapOf("ownedPlayerId" to playerId), UUID.randomUUID()))
        assertEquals(latest["statAfter"], duel["match"]["home"][0]["stats"]["dribbling"])
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
        val challengeLevels = jdbc.query("SELECT player_definition_id, level FROM challenger", { row, _ ->
            row.getString("player_definition_id") to row.getInt("level")
        }).toMap()
        assertEquals(listOf(1, 1, 1, 2, 2, 3, 4, 5),
            jdbc.queryForList("SELECT level FROM challenger ORDER BY spawn_key", Int::class.java))

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
            val early =
                rate(
                    MatchRequest(
                        MatchMode.STADIUM_5V5,
                        listOf(
                            participant(starter, 3),
                            participant("npc_nilo_01", 1),
                            participant("npc_cora_01", challengeLevels.getValue("npc_cora_01")),
                            participant("npc_davi_01", challengeLevels.getValue("npc_davi_01")),
                            participant("npc_bia_01", challengeLevels.getValue("npc_bia_01")),
                        ),
                        away,
                        0,
                        "2",
                    ),
                )
            for (opponent in listOf("npc_cora_01", "npc_davi_01", "npc_bia_01")) {
                val firstDuel = rate(MatchRequest(
                    MatchMode.DUEL_1V1,
                    listOf(participant(starter, 1)),
                    listOf(participant(opponent, challengeLevels.getValue(opponent), "away")),
                    0, "1",
                ))
                val minimum = if (opponent == "npc_bia_01") 0.55 else 0.60
                assertTrue(firstDuel > minimum, "$starter needs a fair opening against $opponent: $firstDuel")
            }
            val explored =
                rate(
                    MatchRequest(
                        MatchMode.STADIUM_5V5,
                        listOf(
                            participant(starter, 3),
                            participant("npc_rui_01", challengeLevels.getValue("npc_rui_01")),
                            participant("npc_sol_01", challengeLevels.getValue("npc_sol_01")),
                            participant("npc_teca_01", challengeLevels.getValue("npc_teca_01")),
                            participant("npc_zeca_01", challengeLevels.getValue("npc_zeca_01")),
                        ),
                        away,
                        0,
                        "2",
                    ),
                )
            println("M7 balance $starter: intro=$intro earlyStadium=$early exploredStadium=$explored (2000 seeds each)")
            assertTrue(intro in 0.68..0.85)
            assertTrue(early in 0.15..0.65, "First five must have a viable chance: $early")
            assertTrue(explored in 0.40..0.85, "Explored lineup: $explored")
            assertTrue(explored > early + 0.08, "Exploring must improve the team")
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
