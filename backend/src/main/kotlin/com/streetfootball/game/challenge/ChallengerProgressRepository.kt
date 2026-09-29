package com.streetfootball.game.challenge

import com.streetfootball.game.match.domain.MatchOutcome
import com.streetfootball.game.recruitment.RecruitmentStatus
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Repository
import java.sql.Timestamp
import java.time.Instant
import java.util.UUID

data class ChallengerProgress(
    val attempts: Int = 0,
    val wins: Int = 0,
    val draws: Int = 0,
    val losses: Int = 0,
    val recruitmentStatus: RecruitmentStatus = RecruitmentStatus.LOCKED,
) {
    fun record(outcome: MatchOutcome) =
        copy(
            attempts = attempts + 1,
            wins = wins + if (outcome == MatchOutcome.WIN) 1 else 0,
            draws = draws + if (outcome == MatchOutcome.DRAW) 1 else 0,
            losses = losses + if (outcome == MatchOutcome.LOSS) 1 else 0,
        )
}

@Repository
class ChallengerProgressRepository(
    private val jdbc: JdbcTemplate,
) {
    fun find(
        profileId: UUID,
        challengerId: UUID,
    ): ChallengerProgress =
        jdbc
            .query(
                "SELECT * FROM challenger_progress WHERE profile_id = ? AND challenger_id = ?",
                {
                    row,
                    _,
                    ->
                    ChallengerProgress(
                        row.getInt("attempts"),
                        row.getInt("wins"),
                        row.getInt("draws"),
                        row.getInt("losses"),
                        RecruitmentStatus.valueOf(row.getString("recruitment_status")),
                    )
                },
                profileId,
                challengerId,
            ).singleOrNull() ?: ChallengerProgress()

    // Caller holds the profile lock for the complete match/reward transaction.
    fun save(
        profileId: UUID,
        challengerId: UUID,
        progress: ChallengerProgress,
        now: Instant,
    ) {
        jdbc.update(
            """
            INSERT INTO challenger_progress (profile_id, challenger_id, attempts, wins, draws, losses, last_played_at, recruitment_status)
            VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            ON CONFLICT (profile_id, challenger_id) DO UPDATE SET
                attempts = EXCLUDED.attempts, wins = EXCLUDED.wins, draws = EXCLUDED.draws,
                losses = EXCLUDED.losses, last_played_at = EXCLUDED.last_played_at, recruitment_status = EXCLUDED.recruitment_status
            """.trimIndent(),
            profileId,
            challengerId,
            progress.attempts,
            progress.wins,
            progress.draws,
            progress.losses,
            Timestamp.from(now),
            progress.recruitmentStatus.name,
        )
    }

    fun markRecruited(
        profileId: UUID,
        challengerId: UUID,
    ) {
        check(
            jdbc.update(
                "UPDATE challenger_progress SET recruitment_status = 'RECRUITED' WHERE profile_id = ? AND challenger_id = ? AND recruitment_status = 'AVAILABLE'",
                profileId,
                challengerId,
            ) ==
                1,
        )
    }
}
