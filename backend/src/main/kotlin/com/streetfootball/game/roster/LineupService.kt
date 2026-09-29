package com.streetfootball.game.roster

import com.streetfootball.game.profile.GameProfileRepository
import com.streetfootball.game.profile.ProfileNotFoundException
import org.springframework.jdbc.core.JdbcTemplate
import org.springframework.stereotype.Service
import org.springframework.transaction.annotation.Transactional
import java.util.UUID

@Service
class LineupService(
    private val profiles: GameProfileRepository,
    private val owned: OwnedPlayerRepository,
    private val jdbc: JdbcTemplate,
) {
    @Transactional(readOnly = true)
    fun get(profileId: UUID): LineupResponse {
        if (!profiles.existsById(profileId)) throw ProfileNotFoundException()
        val slots = MutableList<UUID?>(LineupPolicy.SIZE) { null }
        jdbc.query("SELECT slot_index, owned_player_id FROM user_lineup WHERE profile_id = ?", { row, _ ->
            slots[row.getInt("slot_index") - 1] = row.getObject("owned_player_id", UUID::class.java)
        }, profileId)
        return LineupResponse(slots)
    }

    @Transactional
    fun replace(
        profileId: UUID,
        slots: List<UUID?>,
    ): LineupResponse {
        profiles.findByIdForUpdate(profileId) ?: throw ProfileNotFoundException()
        LineupPolicy.validate(slots, owned.findAllByProfileIdOrderByRecruitedAt(profileId).map { it.id }.toSet())
        jdbc.update("DELETE FROM user_lineup WHERE profile_id = ?", profileId)
        slots.forEachIndexed { index, id ->
            if (id !=
                null
            ) {
                jdbc.update(
                    "INSERT INTO user_lineup (profile_id, slot_index, owned_player_id) VALUES (?, ?, ?)",
                    profileId,
                    index + 1,
                    id,
                )
            }
        }
        return LineupResponse(slots.toList())
    }
}

data class LineupResponse(
    val ownedPlayerIds: List<UUID?>,
)
