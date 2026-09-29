package com.streetfootball.game.match.domain

// Shared bounded contest in basis points. Keep arithmetic stable for historical duel version 1.
internal fun chance(
    attack: Int,
    defense: Int,
): Int = (5000 + (attack - defense) / 2).coerceIn(1000, 9000)

internal fun MatchSide.opponent() = if (this == MatchSide.HOME) MatchSide.AWAY else MatchSide.HOME

internal fun statistics(
    events: List<MatchEvent>,
    side: MatchSide,
): SideStatistics {
    fun count(type: MatchEventType) = events.count { it.side == side && it.type == type }
    return SideStatistics(
        count(MatchEventType.POSSESSION),
        count(MatchEventType.DRIBBLE_SUCCESS),
        count(MatchEventType.TACKLE),
        count(MatchEventType.SHOT),
        count(MatchEventType.GOAL),
    )
}
