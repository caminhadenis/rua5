package com.streetfootball.game

import com.streetfootball.game.match.MatchRepository
import com.streetfootball.game.match.domain.VersionedMatchEngine
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
import java.util.concurrent.CompletableFuture
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class FatigueIntegrationTest {
    @LocalServerPort private var port = 0

    @Autowired private lateinit var jdbc: JdbcTemplate

    @Autowired private lateinit var json: ObjectMapper

    @Autowired private lateinit var matches: MatchRepository

    private data class Player(
        val client: HttpClient,
        val profileId: UUID,
        val id: UUID,
    )

    private fun player(): Player {
        val client = HttpClient.newBuilder().cookieHandler(CookieManager()).build()
        val profile = body(send(client, "POST", "/profiles", mapOf("displayName" to "Cansaço")))
        val starter = body(send(client, "POST", "/profile/starter", mapOf("playerDefinitionId" to "starter_leo")))
        return Player(client, UUID.fromString(profile["id"].asString()), UUID.fromString(starter["id"].asString()))
    }

    private fun fatigue(
        p: Player,
        value: Double,
        secondsAgo: Int = 0,
    ) {
        jdbc.update(
            "UPDATE owned_player SET fatigue = ?, fatigue_updated_at = now() - ? * interval '1 second' WHERE id = ?",
            value,
            secondsAgo,
            p.id,
        )
    }

    private fun roster(p: Player) = body(send(p.client, "GET", "/roster"))[0]

    @Test
    fun `training repeats immediately even exhausted or after legacy waits while preserving gains and retries`() {
        val p = player()
        val payload = mapOf("ownedPlayerId" to p.id.toString(), "focus" to "DRIBBLING")
        val original = roster(p)
        val key = UUID.randomUUID()
        val receipt = body(send(p.client, "POST", "/training/sessions", payload, key))
        assertEquals(12.0, receipt["fatigue"]["after"]["value"].asDouble())
        val trainedAt =
            jdbc
                .queryForObject(
                    "SELECT trained_at FROM training_session WHERE profile_id = ? AND idempotency_key = ?",
                    java.sql.Timestamp::class.java,
                    p.profileId,
                    key,
                )!!
                .toInstant()
        assertEquals(trainedAt.toString(), receipt["nextAvailableAt"].asString())
        assertEquals(original["stats"]["dribbling"].asDouble() + 0.25, receipt["statAfter"].asDouble())
        assertEquals(original["level"], receipt["currentLevel"])
        assertEquals(original["xp"], receipt["currentXp"])
        // A previous session can still carry a legacy 180-second receipt, but it cannot block new training.
        jdbc.update("UPDATE training_session SET cooldown_seconds = 180 WHERE profile_id = ? AND idempotency_key = ?", p.profileId, key)
        val legacy = body(send(p.client, "POST", "/training/sessions", payload, key))
        assertEquals(trainedAt.plusSeconds(180).toString(), legacy["nextAvailableAt"].asString())
        body(send(p.client, "POST", "/training/sessions", payload + ("focus" to "SPEED"), UUID.randomUUID()))
        for ((value, gain) in listOf(24.0 to 0.25, 54.0 to 0.20, 84.0 to 0.15, 100.0 to 0.05)) {
            fatigue(p, value)
            val nextKey = UUID.randomUUID()
            val next = body(send(p.client, "POST", "/training/sessions", payload, nextKey))
            assertTrue(
                next["fatigue"]["after"]["value"].asDouble() in (value + 11.9).coerceAtMost(100.0)..(value + 12.0).coerceAtMost(100.0),
            )
            assertEquals(0, body(send(p.client, "GET", "/training/status"))["cooldowns"].size())
            assertEquals(0, next["xpAwarded"].asInt())
            assertEquals(gain, next["statAfter"].asDouble() - next["statBefore"].asDouble(), 0.000001)
            assertEquals(next, body(send(p.client, "POST", "/training/sessions", payload, nextKey)))
        }
        val storedFatigue = jdbc.queryForObject("SELECT fatigue FROM owned_player WHERE id = ?", Double::class.java, p.id)
        assertEquals(legacy, body(send(p.client, "POST", "/training/sessions", payload, key)))
        assertEquals(storedFatigue, jdbc.queryForObject("SELECT fatigue FROM owned_player WHERE id = ?", Double::class.java, p.id))
        val otherId = UUID.randomUUID()
        jdbc.update(
            "INSERT INTO owned_player (id, profile_id, player_definition_id, recruited_at) VALUES (?, ?, 'starter_rafa', now())",
            otherId,
            p.profileId,
        )
        val other = body(send(p.client, "POST", "/training/sessions", payload + ("ownedPlayerId" to otherId.toString()), UUID.randomUUID()))
        assertEquals(12.0, other["fatigue"]["after"]["value"].asDouble())
        jdbc.update("UPDATE owned_player SET training_dribbling = 9800 WHERE id = ?", p.id)
        val maxed = send(p.client, "POST", "/training/sessions", payload, UUID.randomUUID())
        assertEquals(409, maxed.statusCode())
        assertEquals("TRAINING_STAT_MAX", json.readTree(maxed.body())["code"].asString())
        assertEquals(storedFatigue, jdbc.queryForObject("SELECT fatigue FROM owned_player WHERE id = ?", Double::class.java, p.id))
    }

    @Test
    fun `training uses naturally recovered fatigue before adding the drill cost`() {
        val p = player()
        fatigue(p, 100.0, 1500)
        val receipt =
            body(
                send(
                    p.client,
                    "POST",
                    "/training/sessions",
                    mapOf("ownedPlayerId" to p.id.toString(), "focus" to "SPEED"),
                    UUID.randomUUID(),
                ),
            )
        assertEquals("RESTED", receipt["fatigue"]["before"]["condition"].asString())
        assertEquals(0.25, receipt["statAfter"].asDouble() - receipt["statBefore"].asDouble())
        assertEquals(12.0, receipt["fatigue"]["after"]["value"].asDouble())
    }

    @Test
    fun `street and stadium snapshots use prior fatigue and replay once even with concurrent retries`() {
        val p = player()
        fatigue(p, 68.0)
        val permanent = roster(p)["stats"]
        val key = UUID.randomUUID()
        val path = "/challenges/00000000-0000-4000-8000-000000000001/matches"
        val payload = mapOf("ownedPlayerId" to p.id.toString())
        val concurrent = (1..2).map { CompletableFuture.supplyAsync { body(send(p.client, "POST", path, payload, key)) } }.map { it.get() }
        assertEquals(concurrent[0], concurrent[1])
        val receipt = concurrent[0]
        assertEquals(10, receipt["rewards"]["fatigue"]["before"]["penaltyPercent"].asInt())
        assertTrue(receipt["rewards"]["fatigue"]["after"]["value"].asDouble() in 85.0..86.0)
        for (stat in listOf("speed", "dribbling", "finishing", "defending", "physical")) {
            assertEquals(permanent[stat].asDouble() * 0.9, receipt["match"]["home"][0]["stats"][stat].asDouble())
        }
        val stored = matches.findByKey(p.profileId, key)!!
        assertEquals(stored.result, VersionedMatchEngine().simulate(stored.request))
        fatigue(p, 100.0)
        for (definition in listOf("npc_nilo_01", "starter_breno", "starter_rafa", "stadium_lia")) {
            jdbc.update(
                "INSERT INTO owned_player (id, profile_id, player_definition_id, recruited_at) VALUES (?, ?, ?, now())",
                UUID.randomUUID(),
                p.profileId,
                definition,
            )
        }
        val stadiumPayload = payload + mapOf("roundNumber" to 1)
        val stadiumKey = UUID.randomUUID()
        val stadium = body(send(p.client, "POST", "/stadiums/benfica_stadium/matches", stadiumPayload, stadiumKey))
        assertEquals(15, stadium["rewards"]["players"][0]["fatigue"]["before"]["penaltyPercent"].asInt())
        assertEquals(100.0, stadium["rewards"]["players"][0]["fatigue"]["after"]["value"].asDouble())
        assertEquals(stadium, body(send(p.client, "POST", "/stadiums/benfica_stadium/matches", stadiumPayload, stadiumKey)))
        fatigue(p, 100.0, 1500)
        val recovered = roster(p)
        assertEquals(0.0, recovered["fatigue"]["value"].asDouble())
        assertEquals(recovered["stats"], recovered["matchStats"])
        assertEquals(receipt, body(send(p.client, "POST", path, payload, key)))
        assertEquals(100.0, jdbc.queryForObject("SELECT fatigue FROM owned_player WHERE id = ?", Double::class.java, p.id))
        val foreign = player()
        assertEquals(403, send(foreign.client, "POST", path, payload, UUID.randomUUID()).statusCode())
        assertEquals(
            403,
            send(foreign.client, "POST", "/training/sessions", payload + ("focus" to "SPEED"), UUID.randomUUID()).statusCode(),
        )
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM game_match WHERE profile_id = ?", Int::class.java, foreign.profileId))
    }

    @Test
    fun `persistence failure rolls back match rewards progress and fatigue together`() {
        val p = player()
        val constraint = "fatigue_rollback_" + p.id.toString().replace("-", "")
        jdbc.execute("ALTER TABLE owned_player ADD CONSTRAINT $constraint CHECK (id <> '${p.id}' OR fatigue = 0)")
        try {
            val response =
                send(
                    p.client,
                    "POST",
                    "/challenges/00000000-0000-4000-8000-000000000001/matches",
                    mapOf(
                        "ownedPlayerId" to p.id.toString(),
                    ),
                    UUID.randomUUID(),
                )
            assertEquals(500, response.statusCode())
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM game_match WHERE profile_id = ?", Int::class.java, p.profileId))
            assertEquals(
                0,
                jdbc.queryForObject("SELECT count(*) FROM challenger_progress WHERE profile_id = ?", Int::class.java, p.profileId),
            )
            assertEquals(0.0, roster(p)["fatigue"]["value"].asDouble())
            assertEquals(0, roster(p)["xp"].asInt())
            val training =
                send(
                    p.client,
                    "POST",
                    "/training/sessions",
                    mapOf("ownedPlayerId" to p.id.toString(), "focus" to "SPEED"),
                    UUID.randomUUID(),
                )
            assertEquals(500, training.statusCode())
            assertEquals(0, jdbc.queryForObject("SELECT training_speed FROM owned_player WHERE id = ?", Int::class.java, p.id))
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM training_session WHERE owned_player_id = ?", Int::class.java, p.id))
        } finally {
            jdbc.execute("ALTER TABLE owned_player DROP CONSTRAINT $constraint")
        }
    }

    private fun send(
        client: HttpClient,
        method: String,
        path: String,
        payload: Any = emptyMap<String, String>(),
        key: UUID? = null,
    ): HttpResponse<String> {
        val request = HttpRequest.newBuilder(URI("http://localhost:$port/api/v1$path")).header("Content-Type", "application/json")
        if (key != null) request.header("Idempotency-Key", key.toString())
        request.method(
            method,
            if (method ==
                "GET"
            ) {
                HttpRequest.BodyPublishers.noBody()
            } else {
                HttpRequest.BodyPublishers.ofString(json.writeValueAsString(payload))
            },
        )
        return client.send(request.build(), HttpResponse.BodyHandlers.ofString())
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
