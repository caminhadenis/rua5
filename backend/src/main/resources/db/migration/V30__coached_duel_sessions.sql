CREATE TABLE coached_match (
    id UUID PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES game_profile(id),
    owned_player_id UUID NOT NULL REFERENCES owned_player(id),
    idempotency_key UUID NOT NULL,
    start_command JSONB NOT NULL,
    preparation JSONB NOT NULL,
    state JSONB NOT NULL,
    finished BOOLEAN NOT NULL DEFAULT FALSE,
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    final_match_id UUID UNIQUE REFERENCES game_match(id),
    CHECK (finished = (final_match_id IS NOT NULL)),
    UNIQUE (profile_id, idempotency_key),
    UNIQUE (profile_id, id),
    CHECK ((state->>'step')::integer BETWEEN 0 AND 5)
);
-- One active match per journey; used by resume and activity guards.
CREATE UNIQUE INDEX coached_match_active ON coached_match(profile_id) WHERE NOT finished;
CREATE TABLE coached_match_command (
    profile_id UUID NOT NULL REFERENCES game_profile(id),
    idempotency_key UUID NOT NULL,
    match_id UUID NOT NULL,
    command JSONB NOT NULL,
    receipt JSONB NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (profile_id, idempotency_key),
    FOREIGN KEY (profile_id, match_id) REFERENCES coached_match(profile_id, id)
);
