package com.streetfootball.game.progression

import com.streetfootball.game.challenge.ChallengerProgress
import java.util.UUID

/** Persisted alongside the match: replay must return the original award, even after later matches. */
data class DuelRewards(
    val ownedPlayerId: UUID,
    val xpAwarded: Int,
    val previousLevel: Int,
    val currentLevel: Int,
    val previousXp: Int,
    val currentXp: Int,
    val xpToNextLevel: Int?,
    val challengerProgress: ChallengerProgress,
    val recruitmentUnlocked: Boolean = false,
)
