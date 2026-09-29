package com.streetfootball.game.match

import com.streetfootball.game.match.domain.MatchEvent
import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.match.domain.MatchRequest
import com.streetfootball.game.match.domain.MatchResult
import com.streetfootball.game.match.domain.MatchStatistics
import com.streetfootball.game.match.domain.PenaltyScore
import com.streetfootball.game.progression.DuelRewards
import com.streetfootball.game.stadium.StadiumRewards
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import tools.jackson.databind.ObjectMapper
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

data class StoredMatch(
    val id: UUID,
    val profileId: UUID,
    val sourceId: UUID?,
    val ownedPlayerId: UUID?,
    val idempotencyKey: UUID,
    val request: MatchRequest,
    val result: MatchResult,
    val createdAt: Instant,
    val rewards: DuelRewards? = null,
    val stadiumId: String? = null,
    val stadiumRewards: StadiumRewards? = null,
)

/** JDBC joins the application service's JPA transaction through the same DataSource. */
@Repository
class MatchRepository(
    private val jdbc: JdbcTemplate,
    private val json: ObjectMapper,
) {
    fun findByKey(
        profileId: UUID,
        key: UUID,
    ): StoredMatch? =
        jdbc
            .query(
                "SELECT * FROM game_match WHERE profile_id = ? AND idempotency_key = ?",
                { row, _ ->
                    StoredMatch(
                        id = row.getObject("id", UUID::class.java),
                        profileId = row.getObject("profile_id", UUID::class.java),
                        stadiumId = row.getString("stadium_id"),
                        stadiumRewards =
                            if (row.getString("mode") ==
                                "STADIUM_5V5"
                            ) {
                                row.getString("rewards")?.let { json.readValue(it, StadiumRewards::class.java) }
                            } else {
                                null
                            },
                        sourceId = row.getObject("source_id", UUID::class.java),
                        ownedPlayerId = row.getObject("owned_player_id", UUID::class.java),
                        idempotencyKey = row.getObject("idempotency_key", UUID::class.java),
                        request = json.readValue(row.getString("request_snapshot"), MatchRequest::class.java),
                        result =
                            MatchResult(
                                homeScore = row.getInt("home_score"),
                                awayScore = row.getInt("away_score"),
                                outcome = MatchOutcome.valueOf(row.getString("outcome")),
                                events =
                                    json.readValue(
                                        row.getString("events"),
                                        json.typeFactory.constructCollectionType(List::class.java, MatchEvent::class.java),
                                    ),
                                statistics = json.readValue(row.getString("statistics"), MatchStatistics::class.java),
                                seed = row.getLong("seed"),
                                engineVersion = row.getString("engine_version"),
                                penalties =
                                    (
                                        row.getObject(
                                            "home_penalties",
                                        ) as Int?
                                    )?.let { PenaltyScore(it, row.getInt("away_penalties")) },
                            ),
                        rewards =
                            if (row.getString("mode") ==
                                "DUEL_1V1"
                            ) {
                                row.getString("rewards")?.let { json.readValue(it, DuelRewards::class.java) }
                            } else {
                                null
                            },
                        createdAt = row.getTimestamp("created_at").toInstant(),
                    )
                },
                profileId,
                key,
            ).singleOrNull()

    fun insert(match: StoredMatch) {
        jdbc.update(
            """
            INSERT INTO game_match (
                id, profile_id, owned_player_id, mode, source_type, source_id,
                home_score, away_score, outcome, seed, engine_version,
                request_snapshot, events, statistics, idempotency_key, created_at, rewards, stadium_id, home_penalties, away_penalties
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?::jsonb, ?::jsonb, ?::jsonb, ?, ?, ?::jsonb, ?, ?, ?)
            """.trimIndent(),
            match.id,
            match.profileId,
            match.ownedPlayerId,
            match.request.mode.name,
            if (match.stadiumId == null) "CHALLENGER" else "STADIUM",
            match.sourceId,
            match.result.homeScore,
            match.result.awayScore,
            match.result.outcome.name,
            match.result.seed,
            match.result.engineVersion,
            json.writeValueAsString(match.request),
            json.writeValueAsString(match.result.events),
            json.writeValueAsString(match.result.statistics),
            match.idempotencyKey,
            Timestamp.from(match.createdAt),
            (match.stadiumRewards ?: match.rewards)?.let(json::writeValueAsString),
            match.stadiumId,
            match.result.penalties?.home,
            match.result.penalties?.away,
        )
    }
}
