package com.streetfootball.game.trophy

import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

data class Trophy(
    val id: String,
    val name: String,
    val description: String,
)

@Repository
class TrophyRepository(
    private val jdbc: JdbcTemplate,
) {
    fun ownedIds(profileId: UUID): Set<String> =
        jdbc
            .queryForList(
                "SELECT trophy_id FROM user_trophy WHERE profile_id = ?",
                String::class.java,
                profileId,
            ).filterNotNull()
            .toSet()

    fun definition(id: String): Trophy =
        jdbc
            .query(
                "SELECT * FROM trophy_definition WHERE id = ?",
                { row, _ -> Trophy(row.getString("id"), row.getString("name"), row.getString("description")) },
                id,
            ).single()

    fun grant(
        profileId: UUID,
        trophyId: String,
        stadiumId: String,
        matchId: UUID,
        at: Instant,
        seriesId: UUID? = null,
    ) {
        jdbc.update(
            "INSERT INTO user_trophy (profile_id, trophy_id, stadium_id, match_id, won_at, series_id) VALUES (?, ?, ?, ?, ?, ?)",
            profileId,
            trophyId,
            stadiumId,
            matchId,
            Timestamp.from(at),
            seriesId,
        )
    }
}
