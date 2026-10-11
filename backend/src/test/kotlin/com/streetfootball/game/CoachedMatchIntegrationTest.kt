package com.streetfootball.game

import com.streetfootball.game.match.CoachedMatchRepository
import com.streetfootball.game.match.MatchRepository
import com.streetfootball.game.match.domain.CoachedDuelEngine
import com.streetfootball.game.match.domain.MatchOutcome
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
import java.time.Instant
import java.util.UUID
import java.util.concurrent.CompletableFuture
import kotlin.test.assertEquals
import kotlin.test.assertTrue

@SpringBootTest(webEnvironment = SpringBootTest.WebEnvironment.RANDOM_PORT)
class CoachedMatchIntegrationTest {
    @LocalServerPort private var port = 0

    @Autowired private lateinit var jdbc: JdbcTemplate

    @Autowired private lateinit var json: ObjectMapper

    @Autowired private lateinit var sessions: CoachedMatchRepository

    @Autowired private lateinit var matches: MatchRepository

    private data class Player(
        val client: HttpClient,
        val profileId: UUID,
        val playerId: UUID,
    )

    private val challenger = "00000000-0000-4000-8000-000000000001"

    private fun player(): Player {
        val client = HttpClient.newBuilder().cookieHandler(CookieManager()).build()
        val profile = body(send(client, "POST", "/profiles", mapOf("displayName" to "Treinador")))
        val owned = body(send(client, "POST", "/profile/starter", mapOf("playerDefinitionId" to "starter_leo")))
        return Player(client, UUID.fromString(profile["id"].asString()), UUID.fromString(owned["id"].asString()))
    }

    private fun start(
        p: Player,
        key: UUID = UUID.randomUUID(),
    ) = send(
        p.client,
        "POST",
        "/challenges/$challenger/coached-matches",
        mapOf(
            "ownedPlayerId" to p.playerId,
        ),
        key,
    )

    private fun advance(
        p: Player,
        id: String,
        step: Int,
        key: UUID = UUID.randomUUID(),
        tempo: String = "NORMAL",
        posture: String = "BALANCED",
    ) = send(
        p.client,
        "POST",
        "/coached-matches/$id/advance",
        mapOf(
            "step" to step,
            "instruction" to mapOf("tempo" to tempo, "posture" to posture),
        ),
        key,
    )

    @Test
    fun `roster previews the current coached fatigue curve without changing permanent attributes`() {
        val p = player()
        jdbc.update("UPDATE owned_player SET fatigue = 80, fatigue_updated_at = now() WHERE id = ?", p.playerId)
        val athlete = body(send(p.client, "GET", "/roster"))[0]
        val stats = json.readValue(athlete["stats"].toString(), com.streetfootball.game.match.domain.MatchStats::class.java)
        val expected = CoachedDuelEngine.effectiveStats(stats, athlete["fatigue"]["value"].asDouble())
        assertEquals(json.readTree(json.writeValueAsString(expected)), athlete["coachedMatchStats"])
        assertTrue(athlete["coachedMatchStats"]["speed"].asDouble() < athlete["matchStats"]["speed"].asDouble())
        assertTrue(athlete["coachedMatchStats"]["finishing"].asDouble() > athlete["matchStats"]["finishing"].asDouble())
    }

    @Test
    fun `match persists partial progress resumes and rewards exactly once with durable retry receipts`() {
        val p = player()
        val key = UUID.randomUUID()
        val starts = (1..2).map { CompletableFuture.supplyAsync { body(start(p, key)) } }.map { it.get() }
        assertEquals(starts[0], starts[1])
        val initial = starts[0]
        assertTrue(initial["match"]["outcome"].isNull)
        assertTrue(initial["rewards"].isNull)
        assertEquals(0, initial["match"]["events"].size())
        val id = initial["match"]["id"].asString()
        assertEquals(initial, body(send(p.client, "GET", "/coached-matches/active"))["active"])
        assertEquals(409, start(p).statusCode())
        assertEquals(
            409,
            send(
                p.client,
                "POST",
                "/training/sessions",
                mapOf("ownedPlayerId" to p.playerId, "focus" to "SPEED"),
                UUID.randomUUID(),
            ).statusCode(),
        )
        assertEquals(
            409,
            send(p.client, "POST", "/challenges/$challenger/matches", mapOf("ownedPlayerId" to p.playerId), UUID.randomUUID()).statusCode(),
        )
        assertEquals(
            409,
            send(
                p.client,
                "POST",
                "/roster/${p.playerId}/dismiss",
                mapOf("mapId" to "benfica", "x" to 400, "y" to 400),
                UUID.randomUUID(),
            ).statusCode(),
        )
        val other = player()
        assertEquals(404, send(other.client, "GET", "/coached-matches/$id").statusCode())
        assertEquals(404, advance(other, id, 0).statusCode())
        assertEquals(400, advance(p, id, -1).statusCode())
        assertEquals(400, advance(p, id, 0, tempo = "INVALID").statusCode())
        val firstKey = UUID.randomUUID()
        val first = body(advance(p, id, 0, firstKey, "FAST", "OFFENSIVE"))
        assertEquals(first, body(advance(p, id, 0, firstKey, "FAST", "OFFENSIVE")))
        assertEquals(409, advance(p, id, 0, firstKey).statusCode())
        assertEquals(409, advance(p, id, 0).statusCode())
        assertEquals(first, body(send(p.client, "GET", "/coached-matches/$id")))
        assertTrue(first["homeFatigue"].asDouble() > initial["homeFatigue"].asDouble())
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM game_match WHERE profile_id = ?", Int::class.java, p.profileId))
        assertEquals(0, jdbc.queryForObject("SELECT wins + draws + losses FROM owned_player WHERE id = ?", Int::class.java, p.playerId))
        var last = first
        val finalKey = UUID.randomUUID()
        for (step in 1..4) last = body(advance(p, id, step, if (step == 4) finalKey else UUID.randomUUID(), "SLOW", "DEFENSIVE"))
        assertTrue(last["finished"].asBoolean())
        assertEquals(last, body(advance(p, id, 4, finalKey, "SLOW", "DEFENSIVE")))
        assertEquals(first, body(advance(p, id, 0, firstKey, "FAST", "OFFENSIVE")))
        assertEquals(initial, body(start(p, key)))
        assertEquals(409, advance(p, id, 4).statusCode())
        assertTrue(body(send(p.client, "GET", "/coached-matches/active"))["active"].isNull)
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM game_match WHERE profile_id = ?", Int::class.java, p.profileId))
        assertEquals(1, jdbc.queryForObject("SELECT wins + draws + losses FROM owned_player WHERE id = ?", Int::class.java, p.playerId))
        assertEquals("2", last["rewards"]["fatigue"]["policyVersion"].asString())
        val stored = requireNotNull(matches.findByKey(p.profileId, key))
        assertEquals(5, stored.request.coaching.size)
        assertEquals(stored.result, CoachedDuelEngine().simulate(stored.request))
        assertEquals(
            last["rewards"]["fatigue"]["after"]["value"].asDouble(),
            jdbc.queryForObject("SELECT fatigue FROM owned_player WHERE id = ?", Double::class.java, p.playerId),
        )
    }

    @Test
    fun `final receipt failure rolls back rewards match and the last step`() {
        val p = player()
        val id = body(start(p))["match"]["id"].asString()
        for (step in 0..3) body(advance(p, id, step))
        val key = UUID.randomUUID()
        val constraint = "coached_rollback_" + key.toString().replace("-", "")
        jdbc.execute("ALTER TABLE coached_match_command ADD CONSTRAINT $constraint CHECK (idempotency_key <> '$key')")
        try {
            assertEquals(500, advance(p, id, 4, key).statusCode())
            assertEquals(4, body(send(p.client, "GET", "/coached-matches/$id"))["step"].asInt())
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM game_match WHERE profile_id = ?", Int::class.java, p.profileId))
            assertEquals(0, jdbc.queryForObject("SELECT wins + draws + losses FROM owned_player WHERE id = ?", Int::class.java, p.playerId))
        } finally {
            jdbc.execute("ALTER TABLE coached_match_command DROP CONSTRAINT $constraint")
        }
        assertTrue(body(advance(p, id, 4, key))["finished"].asBoolean())
    }

    @Test
    fun `stadium reserves the round and grants the trophy only after five completed winning duels`() {
        val p = player()
        for (definition in listOf(
            "npc_nilo_01",
            "npc_cora_01",
            "npc_davi_01",
            "npc_bia_01",
        )) {
            jdbc.update(
                "INSERT INTO owned_player(id, profile_id, player_definition_id, recruited_at) VALUES (?, ?, ?, now())",
                UUID.randomUUID(),
                p.profileId,
                definition,
            )
        }
        jdbc.update(
            "UPDATE owned_player SET training_speed = 7500, training_dribbling = 7500, training_finishing = 7500, training_defending = 7500, training_physical = 7500 WHERE id = ?",
            p.playerId,
        )
        var seriesId: String? = null
        for (round in 1..5) {
            val key = UUID.randomUUID()
            val path = "/stadiums/benfica_stadium/coached-matches"
            val payload = mapOf("ownedPlayerId" to p.playerId, "seriesId" to seriesId, "roundNumber" to round)
            val receipt = body(send(p.client, "POST", path, payload, key))
            val id = UUID.fromString(receipt["match"]["id"].asString())
            val original = sessions.get(p.profileId, id)
            val engine = CoachedDuelEngine()
            val input =
                (0L..999L)
                    .map {
                        original.prepared.request.copy(
                            seed = it,
                        )
                    }.first { engine.simulate(it).outcome == MatchOutcome.WIN }
            sessions.update(original.copy(prepared = original.prepared.copy(request = input), state = engine.start(input)), Instant.now())
            assertEquals(round - 1, body(send(p.client, "GET", "/stadiums/benfica_stadium"))["series"]["played"].asInt())
            var finished = receipt
            for (step in 0..4) finished = body(advance(p, id.toString(), step))
            val rewards = finished["stadiumRewards"]
            assertEquals(round, rewards["series"]["played"].asInt())
            assertEquals(round == 5, !rewards["trophy"].isNull)
            seriesId = rewards["series"]["id"].asString()
            assertEquals(receipt, body(send(p.client, "POST", path, payload, key)))
        }
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM user_trophy WHERE profile_id = ?", Int::class.java, p.profileId))
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
