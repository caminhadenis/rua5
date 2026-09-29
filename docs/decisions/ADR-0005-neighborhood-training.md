# ADR-0005 — Neighborhood training

## Status
Accepted

## Context

The initial neighborhood put most challengers above a level-one starter. Players also
need a way to progress a chosen athlete without repeatedly challenging an NPC.

## Decision

The Benfica map has one stable training point. A profile-owned player can complete a
drill focused on one of the six existing stats. Each drill grants 8 XP toward the
same level progression used by duels. Focus is recorded for history, while effective
stats still grow uniformly with level. A 90-second cooldown applies per player.
Training commands are serialized by the existing profile lock, persist a session
with a unique idempotency key, and return the original result on retry.

The V11 migration lowers early challenger levels and selected base stats for future
matches. It leaves match snapshots and previously recruited athletes intact.

## Consequences

Thirteen drills are needed to advance from level one without a duel. New challenger
victories remain the faster route. The map can be enlarged and spawns moved without
changing backend content IDs. Targeted stat bonuses could be added later with a
separate rule and persistence change if playtesting supports them.

## Alternatives considered

Unlimited instant drills would reward repeated clicking more than exploration.
Client-calculated training XP would break server authority. Adding a new stat growth
system now would conflict with the existing +1-per-level rule and increase balance
scope beyond the requested neighborhood adjustment.
