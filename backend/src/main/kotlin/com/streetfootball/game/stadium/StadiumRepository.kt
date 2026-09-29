package com.streetfootball.game.stadium

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.util.UUID

data class Stadium(
    val id: String,
    val name: String,
    val type: String,
    val mapId: String,
    val spawnKey: String,
    val difficulty: Int,
    val keeperBase: Int,
    val trophyId: String,
    val enabled: Boolean,
)

data class OpponentSlot(
    val slot: Int,
    val definitionId: String,
    val level: Int,
)

@Repository
class StadiumRepository(
    private val jdbc: JdbcTemplate,
) {
    fun all(): List<Stadium> =
        jdbc.query("SELECT * FROM stadium ORDER BY id", { row, _ ->
            Stadium(
                row.getString("id"),
                row.getString("name"),
                row.getString("type"),
                row.getString("map_id"),
                row.getString("spawn_key"),
                row.getInt("difficulty"),
                row.getInt("keeper_base"),
                row.getString("trophy_id"),
                row.getBoolean("enabled"),
            )
        })

    fun find(id: String) = all().find { it.id == id } ?: throw StadiumRuleException("STADIUM_NOT_FOUND")

    fun requirements(id: String): List<String> =
        jdbc
            .queryForList(
                "SELECT required_trophy_id FROM stadium_requirement WHERE stadium_id = ? ORDER BY required_trophy_id",
                String::class.java,
                id,
            ).filterNotNull()

    fun opponents(id: String): List<OpponentSlot> =
        jdbc.query(
            "SELECT * FROM stadium_opponent_player WHERE stadium_id = ? ORDER BY slot_index",
            { row, _ -> OpponentSlot(row.getInt("slot_index"), row.getString("player_definition_id"), row.getInt("level")) },
            id,
        )

    fun attempts(
        profileId: UUID,
        id: String,
    ): Int =
        jdbc.queryForObject(
            "SELECT count(*) FROM game_match WHERE profile_id = ? AND stadium_id = ?",
            Int::class.java,
            profileId,
            id,
        )!!
}
