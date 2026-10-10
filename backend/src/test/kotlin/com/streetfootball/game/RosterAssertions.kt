package com.streetfootball.game

import tools.jackson.databind.JsonNode

/** Fatigue and its match preview are time-dependent projections, not durable progression. */
fun persistentRoster(roster: JsonNode) =
    roster.map { player ->
        player.properties().filter { it.key !in setOf("fatigue", "matchStats") }.associate { it.key to it.value }
    }
