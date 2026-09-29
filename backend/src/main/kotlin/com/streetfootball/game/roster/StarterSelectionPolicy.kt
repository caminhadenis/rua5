package com.streetfootball.game.roster

class StarterSelectionPolicy {
    fun decide(
        starterSelected: Boolean,
        requestedStarterAlreadyOwned: Boolean,
    ): StarterSelectionDecision =
        when {
            starterSelected && requestedStarterAlreadyOwned -> StarterSelectionDecision.ALREADY_GRANTED
            starterSelected -> throw StarterAlreadySelectedException()
            requestedStarterAlreadyOwned -> throw InconsistentStarterStateException()
            else -> StarterSelectionDecision.GRANT
        }
}

enum class StarterSelectionDecision {
    GRANT,
    ALREADY_GRANTED,
}

class StarterAlreadySelectedException : RuntimeException("A different starter was already selected.")

class StarterNotFoundException : RuntimeException("The requested starter is not available.")

class InconsistentStarterStateException : RuntimeException("The profile starter state is inconsistent.")
