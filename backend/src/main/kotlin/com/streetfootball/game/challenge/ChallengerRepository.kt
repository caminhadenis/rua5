package com.streetfootball.game.challenge

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.util.UUID

data class Challenger(
    val id: UUID,
    val playerDefinitionId: String,
    val mapId: String,
    val spawnKey: String,
    val level: Int,
    val enabled: Boolean,
)

@Repository
class ChallengerRepository(
    private val jdbc: JdbcTemplate,
) {
    fun findById(id: UUID): Challenger? =
        jdbc
            .query(
                "SELECT id, player_definition_id, map_id, spawn_key, level, enabled FROM challenger WHERE id = ?",
                { row, _ ->
                    Challenger(
                        row.getObject("id", UUID::class.java),
                        row.getString("player_definition_id"),
                        row.getString("map_id"),
                        row.getString("spawn_key"),
                        row.getInt("level"),
                        row.getBoolean("enabled"),
                    )
                },
                id,
            ).singleOrNull()
}
