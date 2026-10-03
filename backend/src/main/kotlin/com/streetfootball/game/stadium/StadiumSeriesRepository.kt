package com.streetfootball.game.stadium

import com.streetfootball.game.match.domain.MatchParticipant
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

data class StadiumSeries(
    val id: UUID,
    val played: Int,
    val wins: Int,
    val finished: Boolean,
    val opponents: List<MatchParticipant>,
)

data class SeriesProgress(
    val id: UUID,
    val played: Int,
    val wins: Int,
    val finished: Boolean,
)

fun StadiumSeries.progress() = SeriesProgress(id, played, wins, finished)

@Repository
class StadiumSeriesRepository(
    private val jdbc: JdbcTemplate,
    private val json: ObjectMapper,
) {
    fun latest(
        profileId: UUID,
        stadiumId: String,
    ): StadiumSeries? =
        jdbc
            .query(
                "SELECT * FROM stadium_series WHERE profile_id = ? AND stadium_id = ? ORDER BY created_at DESC, id DESC LIMIT 1",
                { row, _ ->
                    StadiumSeries(
                        row.getObject("id", UUID::class.java),
                        row.getInt("played"),
                        row.getInt("wins"),
                        row.getBoolean("finished"),
                        json.readValue(
                            row.getString("opponents"),
                            json.typeFactory.constructCollectionType(List::class.java, MatchParticipant::class.java),
                        ),
                    )
                },
                profileId,
                stadiumId,
            ).singleOrNull()

    fun start(
        profileId: UUID,
        stadiumId: String,
        opponents: List<MatchParticipant>,
    ): StadiumSeries {
        val series = StadiumSeries(UUID.randomUUID(), 0, 0, false, opponents)
        jdbc.update(
            "INSERT INTO stadium_series(id, profile_id, stadium_id, opponents, created_at) VALUES (?, ?, ?, ?::jsonb, ?)",
            series.id,
            profileId,
            stadiumId,
            json.writeValueAsString(opponents),
            Timestamp.from(Instant.now()),
        )
        return series
    }

    fun advance(
        series: StadiumSeries,
        won: Boolean,
    ): StadiumSeries {
        val next =
            series.copy(
                played = series.played + 1,
                wins = series.wins + if (won) 1 else 0,
                finished = !won || series.played + 1 == 5,
            )
        jdbc.update(
            "UPDATE stadium_series SET played = ?, wins = ?, finished = ? WHERE id = ?",
            next.played,
            next.wins,
            next.finished,
            next.id,
        )
        return next
    }
}
