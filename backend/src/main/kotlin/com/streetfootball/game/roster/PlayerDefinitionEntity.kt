package com.streetfootball.game.roster

import jakarta.persistence.Column
import jakarta.persistence.Entity
import jakarta.persistence.EnumType
import jakarta.persistence.Enumerated
import jakarta.persistence.Id
import jakarta.persistence.Table

@Entity
@Table(name = "player_definition")
class PlayerDefinitionEntity(
    @field:Id
    @field:Column(length = 64)
    var id: String = "",
    @field:Column(nullable = false, length = 80)
    var name: String = "",
    @field:Enumerated(EnumType.STRING)
    @field:Column(nullable = false, length = 24)
    var archetype: Archetype = Archetype.DRIBBLER,
    @field:Enumerated(EnumType.STRING)
    @field:Column(name = "preferred_role", nullable = false, length = 24)
    var preferredRole: PreferredRole = PreferredRole.ATTACKER,
    @field:Enumerated(EnumType.STRING)
    @field:Column(nullable = false, length = 24)
    var rarity: Rarity = Rarity.COMMON,
    @field:Column(nullable = false)
    var speed: Int = 1,
    @field:Column(nullable = false)
    var dribbling: Int = 1,
    @field:Column(nullable = false)
    var passing: Int = 1,
    @field:Column(nullable = false)
    var finishing: Int = 1,
    @field:Column(nullable = false)
    var defending: Int = 1,
    @field:Column(nullable = false)
    var physical: Int = 1,
    @field:Column(nullable = false)
    var recruitable: Boolean = false,
    @field:Column(nullable = false)
    var starter: Boolean = false,
    @field:Column(nullable = false)
    var enabled: Boolean = true,
)

enum class Archetype {
    DRIBBLER,
    FINISHER,
    PLAYMAKER,
    MARKER,
}

enum class PreferredRole {
    DEFENDER,
    MIDFIELDER,
    ATTACKER,
}

enum class Rarity {
    COMMON,
    UNCOMMON,
    RARE,
}
