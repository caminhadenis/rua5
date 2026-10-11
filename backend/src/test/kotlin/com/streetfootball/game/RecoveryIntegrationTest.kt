package com.streetfootball.game

import com.streetfootball.game.match.MatchRepository
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
class RecoveryIntegrationTest {
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
        val profile = body(send(client, "POST", "/profiles", mapOf("displayName" to "Recuperação")))
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

    private fun start(
        p: Player,
        station: String = "benfica.recovery.bed.01",
        key: UUID = UUID.randomUUID(),
        id: UUID = p.id,
    ) = send(p.client, "POST", "/recovery/sessions", mapOf("ownedPlayerId" to id.toString(), "stationId" to station), key)

    private fun second(p: Player): UUID {
        val id = UUID.randomUUID()
        jdbc.update(
            "INSERT INTO owned_player (id, profile_id, player_definition_id, recruited_at, fatigue, fatigue_updated_at) VALUES (?, ?, 'starter_rafa', now(), 100, now())",
            id,
            p.profileId,
        )
        return id
    }

    @Test
    fun `treatment persists faster fatigue and blocks activities then cancellation preserves progress and retries`() {
        val p = player()
        fatigue(p, 100.0)
        val original = roster(p)
        val key = UUID.randomUUID()
        val receipts = (1..2).map { CompletableFuture.supplyAsync { body(start(p, key = key)) } }.map { it.get() }
        assertEquals(receipts[0], receipts[1])
        val receipt = receipts[0]
        val id = receipt["session"]["id"].asString()
        assertEquals("REST", receipt["session"]["method"].asString())
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM recovery_session WHERE profile_id = ?", Int::class.java, p.profileId))
        assertEquals(id, roster(p)["recovery"]["sessionId"].asString())
        assertEquals(original["stats"], roster(p)["stats"])
        assertEquals(
            409,
            send(
                p.client,
                "POST",
                "/training/sessions",
                mapOf("ownedPlayerId" to p.id, "focus" to "SPEED"),
                UUID.randomUUID(),
            ).statusCode(),
        )
        assertEquals(
            409,
            send(
                p.client,
                "POST",
                "/challenges/00000000-0000-4000-8000-000000000001/matches",
                mapOf("ownedPlayerId" to p.id),
                UUID.randomUUID(),
            ).statusCode(),
        )
        second(p)
        for (definition in listOf("npc_nilo_01", "starter_breno", "stadium_lia")) {
            jdbc.update(
                "INSERT INTO owned_player (id, profile_id, player_definition_id, recruited_at) VALUES (?, ?, ?, now())",
                UUID.randomUUID(),
                p.profileId,
                definition,
            )
        }
        val stadium =
            send(
                p.client,
                "POST",
                "/stadiums/benfica_stadium/matches",
                mapOf("ownedPlayerId" to p.id, "roundNumber" to 1),
                UUID.randomUUID(),
            )
        assertEquals(409, stadium.statusCode())
        assertEquals("PLAYER_RECOVERING", json.readTree(stadium.body())["code"].asString())
        assertEquals(
            409,
            send(
                p.client,
                "POST",
                "/roster/${p.id}/dismiss",
                mapOf("mapId" to "benfica", "x" to 496, "y" to 2456),
                UUID.randomUUID(),
            ).statusCode(),
        )
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM training_session WHERE profile_id = ?", Int::class.java, p.profileId))
        assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM game_match WHERE profile_id = ?", Int::class.java, p.profileId))
        val foreign = player()
        fatigue(foreign, 100.0)
        assertEquals(403, start(foreign, id = p.id).statusCode())
        assertEquals(404, send(foreign.client, "POST", "/recovery/sessions/$id/cancel", key = UUID.randomUUID()).statusCode())
        assertEquals(409, start(p, station = "benfica.recovery.ice.01", key = key).statusCode())
        // Advance one second of the five-second treatment without needing a scheduler.
        jdbc.update(
            "UPDATE owned_player SET fatigue_updated_at = now() - interval '1 second', recovery_ends_at = now() + interval '4 seconds' WHERE id = ?",
            p.id,
        )
        val cancelKey = UUID.randomUUID()
        val cancelled = body(send(p.client, "POST", "/recovery/sessions/$id/cancel", key = cancelKey))
        assertTrue(cancelled["fatigue"]["value"].asDouble() in 74.0..80.0)
        assertEquals(true, roster(p)["recovery"].isNull)
        val another = body(start(p, station = "benfica.recovery.ice.01"))
        assertEquals(cancelled, body(send(p.client, "POST", "/recovery/sessions/$id/cancel", key = cancelKey)))
        assertEquals(another["session"]["id"], roster(p)["recovery"]["sessionId"])
        assertEquals(receipt, body(start(p, key = key)))
        assertEquals(409, send(p.client, "POST", "/recovery/sessions/$id/cancel", key = UUID.randomUUID()).statusCode())
    }

    @Test
    fun `station contention serializes per profile and does not block other journeys`() {
        val p = player()
        fatigue(p, 100.0)
        val otherId = second(p)
        val attempts = listOf(p.id, otherId).map { id -> CompletableFuture.supplyAsync { start(p, id = id) } }.map { it.get() }
        assertEquals(listOf(200, 409), attempts.map { it.statusCode() }.sorted())
        val rejected = attempts.single { it.statusCode() == 409 }
        assertEquals("RECOVERY_STATION_OCCUPIED", json.readTree(rejected.body())["code"].asString())
        assertEquals(1, jdbc.queryForObject("SELECT count(*) FROM recovery_session WHERE profile_id = ?", Int::class.java, p.profileId))
        val foreign = player()
        fatigue(foreign, 100.0)
        assertEquals(200, start(foreign).statusCode())
        val inactive = player()
        fatigue(inactive, 50.0)
        jdbc.update("UPDATE owned_player SET roster_active = false WHERE id = ?", inactive.id)
        assertEquals(404, start(inactive).statusCode())
        assertEquals(409, start(player()).statusCode())
        assertEquals(404, start(player(), station = "unknown").statusCode())
    }

    @Test
    fun `completed treatment releases athlete automatically and old retries cannot erase subsequent fatigue`() {
        val p = player()
        fatigue(p, 100.0)
        val key = UUID.randomUUID()
        val receipt = body(start(p, station = "benfica.recovery.ice.01", key = key))
        jdbc.update(
            "UPDATE owned_player SET fatigue_updated_at = now() - interval '120 seconds', recovery_ends_at = now() - interval '20 seconds' WHERE id = ?",
            p.id,
        )
        assertEquals(0.0, roster(p)["fatigue"]["value"].asDouble())
        assertTrue(roster(p)["recovery"].isNull)
        val trained =
            body(send(p.client, "POST", "/training/sessions", mapOf("ownedPlayerId" to p.id, "focus" to "SPEED"), UUID.randomUUID()))
        assertEquals(12.0, trained["fatigue"]["after"]["value"].asDouble())
        assertEquals(receipt, body(start(p, station = "benfica.recovery.ice.01", key = key)))
        assertTrue(roster(p)["fatigue"]["value"].asDouble() > 11.0)
        assertTrue(roster(p)["recovery"].isNull)
        // The new southern map coordinates persist for dismissal as well.
        assertEquals(
            200,
            send(
                p.client,
                "POST",
                "/roster/${p.id}/dismiss",
                mapOf("mapId" to "benfica", "x" to 496, "y" to 2456),
                UUID.randomUUID(),
            ).statusCode(),
        )
    }

    @Test
    fun `failed durable receipt rolls back session and athlete state together`() {
        val p = player()
        fatigue(p, 100.0)
        val constraint = "recovery_rollback_" + p.id.toString().replace("-", "")
        jdbc.execute("ALTER TABLE recovery_command ADD CONSTRAINT $constraint CHECK (target_id <> '${p.id}')")
        try {
            assertEquals(500, start(p).statusCode())
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM recovery_session WHERE profile_id = ?", Int::class.java, p.profileId))
            assertEquals(0, jdbc.queryForObject("SELECT count(*) FROM recovery_command WHERE profile_id = ?", Int::class.java, p.profileId))
            assertTrue(roster(p)["recovery"].isNull)
            assertEquals(100.0, jdbc.queryForObject("SELECT fatigue FROM owned_player WHERE id = ?", Double::class.java, p.id))
        } finally {
            jdbc.execute("ALTER TABLE recovery_command DROP CONSTRAINT $constraint")
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
