package com.streetfootball.game.match

import com.streetfootball.game.match.domain.MatchParticipant
import com.streetfootball.game.match.domain.MatchStats
import com.streetfootball.game.progression.FatiguePolicy
import com.streetfootball.game.progression.Progression
import com.streetfootball.game.roster.OwnedPlayerEntity
import com.streetfootball.game.roster.PlayerDefinitionEntity

internal fun PlayerDefinitionEntity.snapshot(
    playerId: String,
    level: Int,
    owned: OwnedPlayerEntity? = null,
    fatigue: Double = 0.0,
) = MatchParticipant(
    playerId,
    id,
    name,
    level,
    FatiguePolicy.matchStats(
        Progression.effectiveStats(
            MatchStats(speed, dribbling, finishing, defending, physical),
            level,
            owned?.trainingBonuses() ?: com.streetfootball.game.progression
                .StatBonuses(),
        ),
        fatigue,
    ),
)
