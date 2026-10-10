package com.streetfootball.game.progression

import java.time.Duration
import java.time.Instant

enum class RecoveryMethod {
    REST,
    ICE_BATH,
}

data class RecoveryStatus(
    val sessionId: java.util.UUID,
    val stationId: String,
    val method: RecoveryMethod,
    val completesAt: Instant,
)

/** Any treatment station fully recovers the athlete in five seconds. */
object RecoveryPolicy {
    private const val DURATION_MILLIS = 5_000L
    val stations =
        mapOf(
            "benfica.recovery.bed.01" to RecoveryMethod.REST,
            "benfica.recovery.bed.02" to RecoveryMethod.REST,
            "benfica.recovery.bed.03" to RecoveryMethod.REST,
            "benfica.recovery.ice.01" to RecoveryMethod.ICE_BATH,
            "benfica.recovery.ice.02" to RecoveryMethod.ICE_BATH,
        )

    fun recover(
        value: Double,
        reference: Instant,
        now: Instant,
    ): Double {
        require(value.isFinite() && value in 0.0..100.0)
        val elapsed = Duration.between(reference, now).toMillis().coerceAtLeast(0)
        if (elapsed >= DURATION_MILLIS) return 0.0
        return (value * (1.0 - elapsed.toDouble() / DURATION_MILLIS)).coerceAtLeast(0.0)
    }

    fun completesAt(
        value: Double,
        now: Instant,
    ): Instant {
        require(value.isFinite() && value in 0.0..100.0)
        return now.plusMillis(DURATION_MILLIS)
    }
}

class RecoveryRuleException(
    val code: String,
) : RuntimeException()
