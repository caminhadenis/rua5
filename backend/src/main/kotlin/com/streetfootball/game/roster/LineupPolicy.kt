package com.streetfootball.game.roster

import com.streetfootball.game.challenge.PlayerNotOwnedException
import java.util.UUID

object LineupPolicy {
    const val SIZE = 5

    fun validate(
        slots: List<UUID?>,
        ownedIds: Set<UUID>,
    ) {
        val selected = slots.filterNotNull()
        if (slots.size != SIZE || selected.distinct().size != selected.size) throw InvalidLineupException()
        if (!ownedIds.containsAll(selected)) throw PlayerNotOwnedException()
    }
}

class InvalidLineupException : RuntimeException("Lineup requires five slots and distinct players.")
