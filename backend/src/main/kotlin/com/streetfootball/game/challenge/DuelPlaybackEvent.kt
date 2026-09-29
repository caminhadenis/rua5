package com.streetfootball.game.challenge

import com.streetfootball.game.match.domain.MatchEvent
import com.streetfootball.game.match.domain.MatchEventType
import com.streetfootball.game.match.domain.MatchSide

/** API presentation of the persisted timeline; does not change engine version or historical events. */
data class DuelPlaybackEvent(
    val sequence: Int,
    val minute: Int,
    val type: MatchEventType,
    val side: MatchSide,
    val actorPlayerId: String,
    val targetPlayerId: String?,
    val metadata: Map<String, String>,
    val homeScore: Int,
    val awayScore: Int,
)

fun playbackEvents(events: List<MatchEvent>): List<DuelPlaybackEvent> {
    var homeScore = 0
    var awayScore = 0
    return events.map { event ->
        if (event.type == MatchEventType.GOAL) {
            if (event.side == MatchSide.HOME) homeScore++ else awayScore++
        }
        DuelPlaybackEvent(
            event.sequence,
            event.minute,
            event.type,
            event.side,
            event.actorPlayerId,
            event.targetPlayerId,
            event.metadata,
            homeScore,
            awayScore,
        )
    }
}
