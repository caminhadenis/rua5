# ADR-0016 — Isolated recovery center

## Status

Accepted feature requested explicitly by the user. Treatment duration is five seconds
for every station; no fee, currency, unlock requirement or medical simulation is introduced.

## Context

Natural recovery should continue, with a second way to rest athletes in a dedicated
building. The user requested healthcare staff, stretchers, ice tubs and a deliberately
long walk to discourage constant short trips after activities.

## Decision

Extend Benfica southward to 72×84 tiles, keeping existing content in place. Connect a
remote recovery clearing to the old southern border by one winding walkable trail.
Vegetation collides, and map tests measure a route longer than 2800 pixels from both
the training center and stadium. Local checkpoints and released-player coordinate
validation are expanded together; existing migrations and saved positions are preserved.

Provide three beds and two ice tubs. Either station fully recovers any positive fatigue
level in five seconds; station type has no effect on recovery speed. Natural recovery
stays at four points per minute elsewhere. Treatment continues offline. Athletes cannot train,
play or be dismissed during treatment. They become available automatically at completion.
Interruption in the clinic keeps recovered fatigue and restores the natural rate.

Persist treatment references per owned athlete, historical sessions and start/cancel
receipts in V25. Use existing profile locks to serialize occupation, activity and retries.
No scheduler or new dependency is necessary. GET roster projects treatment and fatigue
at current server time; no browser countdown grants availability. Fixed original receipts
precede mutable ownership/activity checks. Cancellation targets a session ID so a delayed
retry cannot cancel a later treatment. Unknown/foreign treatment IDs return 404.

Clinic geometry and interaction proximity remain static client presentation, as with
training and other buildings. They are not server-authenticated coordinates. Ownership,
station IDs, occupation, availability, duration and persistence are server-authoritative.
Visitors are static ambience and never become roster entries; owned athletes preserve
their original identity and team colors. The game remains single-player.

## Consequences

Recovery becomes an exploration decision without removing natural recovery. Leaving
players in treatment encourages rotation. Up to five own athletes can recover at once,
within the existing roster cap. Historical matches, rewards, XP, permanent stats and
training bonuses are unaffected. Every new activity clears completed references before
storing its ordinary fatigue so the accelerated rate cannot leak into later activities.
