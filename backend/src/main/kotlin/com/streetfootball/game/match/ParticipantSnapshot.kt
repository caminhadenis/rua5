package com.streetfootball.game.match

import com.streetfootball.game.match.domain.MatchParticipant
import com.streetfootball.game.match.domain.MatchStats
import com.streetfootball.game.progression.Progression
import com.streetfootball.game.roster.PlayerDefinitionEntity
import com.streetfootball.game.roster.OwnedPlayerEntity

internal fun PlayerDefinitionEntity.snapshot(
    playerId: String,
    level: Int,
    owned: OwnedPlayerEntity? = null,
) = MatchParticipant(
    playerId,
    id,
    name,
    level,
    Progression.effectiveStats(MatchStats(speed, dribbling, passing, finishing, defending, physical), level, owned?.trainingBonuses() ?: com.streetfootball.game.progression.StatBonuses()),
)
