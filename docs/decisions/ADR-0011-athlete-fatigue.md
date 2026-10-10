# ADR-0011 — Individual athlete fatigue

## Status
Accepted by explicit user request. Training delays superseded by ADR-0012.

## Context
Repeated training and street challenges should encourage roster rotation while preserving
several consecutive uses of one athlete. Section 41.5 previously excluded fatigue between
matches; the user explicitly requested and approved this extension.

## Decision
Persist fatigue (0–100) and its UTC reference per owned athlete. Recover four points per
real minute on demand, including offline time. Training costs 12; both duel modes cost 18.
Conditions at 30/60/85 reduce all five match attributes by 5/10/15 percent, with a minimum
of one. Matches remain available at maximum fatigue. Permanent stats, XP, training quarter
points and NPC snapshots remain unchanged.

Use prior fatigue for the fixed match snapshot. Store post-activity fatigue with rewards
in the same transaction. Training delay is 60/90/120/180 seconds according to post-session
fatigue, stored per receipt; later duels do not extend that receipt's delay. Retain existing
profile locks and idempotency. Old receipts remain readable without a fatigue payload.

Roster responses preserve permanent stats and expose adjusted match stats and condition
recovery timestamps. Open selection panels refresh from REST every 15 seconds. No client
clock can authorize an activity or decide match stats. Engine versions remain unchanged:
their deterministic inputs already persist the adjusted stats. Fatigue receipts record
policy version 1 for auditing.

## Consequences
Rotation becomes useful; a single starter can still play. Long training runs slow down
without diminishing their permanent quarter-point gain. Recovery requires no scheduler,
queue or new dependency. V22 starts existing athletes rested and preserves legacy receipt
delays. The numeric settings are initial balancing parameters and should be evaluated
against real play, particularly fatigue during the five stadium rounds.

## Alternatives considered
Hard energy lockouts would interrupt the starter flow. Reducing XP as well would compound
existing rematch penalties. Instant rest would make fatigue irrelevant. Reading live fatigue
inside the engine would violate isolation and historical reproducibility.
