package com.streetfootball.game.roster

object RosterPolicy {
    const val MAX_PLAYERS = 5

    fun requireVacancy(count: Long) {
        if (count >= MAX_PLAYERS) throw RosterFullException()
    }
}

class RosterFullException : RuntimeException()

class InvalidDismissalLocationException : RuntimeException()
