# ADR-0012 — Immediate consecutive training

## Status
Accepted by explicit user request. Supersedes the training delay in ADR-0011.

## Context
With individual fatigue implemented, the user requested removal of the waiting period
between training sessions. Fatigue should remain the consequence of repeated training.

## Decision
Remove server cooldown checks and client countdowns. Allow another session immediately
once the current five-second animation ends, even at maximum fatigue. Each new session
still grants +0.25 to its permanent attribute up to 99 and adds 12 fatigue; XP and level
remain unchanged. Preserve ownership checks, profile locking and idempotency.

V23 allows cooldown_seconds = 0 and defaults new sessions to zero. Keep historical
cooldown values and nextAvailableAt receipts for idempotent replay only. Status keeps
its existing shape with an empty cooldowns list; new receipts use the session timestamp
for nextAvailableAt. Existing waiting periods do not prevent new sessions.

The training panel keeps selection and the repeat action available after success. If
the command succeeds but roster refresh fails, cache the confirmed receipt and retry
only the roster refresh to prevent an unintended extra session.

## Consequences
Consecutive training becomes faster and still worsens subsequent match performance.
Fatigue accumulation, recovery, penalties and permanent gains remain unchanged. No new
dependency or background process is needed. The five-second drill animation stays.
