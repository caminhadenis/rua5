CREATE TABLE challenger (
    id UUID PRIMARY KEY,
    player_definition_id VARCHAR(64) NOT NULL REFERENCES player_definition(id),
    map_id VARCHAR(64) NOT NULL,
    spawn_key VARCHAR(128) NOT NULL,
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 15),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT challenger_spawn_unique UNIQUE (map_id, spawn_key)
);

CREATE TABLE game_match (
    id UUID PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES game_profile(id),
    owned_player_id UUID NOT NULL REFERENCES owned_player(id),
    mode VARCHAR(24) NOT NULL CHECK (mode = 'DUEL_1V1'),
    source_type VARCHAR(24) NOT NULL CHECK (source_type = 'CHALLENGER'),
    source_id UUID NOT NULL REFERENCES challenger(id),
    home_score INTEGER NOT NULL CHECK (home_score >= 0),
    away_score INTEGER NOT NULL CHECK (away_score >= 0),
    outcome VARCHAR(8) NOT NULL,
    seed BIGINT NOT NULL,
    engine_version VARCHAR(16) NOT NULL CHECK (char_length(btrim(engine_version)) > 0),
    request_snapshot JSONB NOT NULL CHECK (jsonb_typeof(request_snapshot) = 'object'),
    events JSONB NOT NULL CHECK (jsonb_typeof(events) = 'array'),
    statistics JSONB NOT NULL CHECK (jsonb_typeof(statistics) = 'object'),
    idempotency_key UUID NOT NULL,
    created_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT game_match_idempotency_unique UNIQUE (profile_id, idempotency_key),
    CONSTRAINT game_match_outcome_valid CHECK (
        (outcome = 'WIN' AND home_score > away_score) OR
        (outcome = 'LOSS' AND home_score < away_score) OR
        (outcome = 'DRAW' AND home_score = away_score)
    )
);

-- A single level-one opponent for the existing static map spawn. No map geometry is persisted.
INSERT INTO player_definition (
    id, name, archetype, preferred_role, rarity,
    speed, dribbling, passing, finishing, defending, physical, recruitable, starter, enabled
) VALUES (
    'npc_nilo_01', 'Nilo', 'MARKER', 'DEFENDER', 'COMMON',
    62, 59, 60, 58, 70, 65, TRUE, FALSE, TRUE
);

INSERT INTO challenger (id, player_definition_id, map_id, spawn_key, level, enabled)
VALUES ('00000000-0000-4000-8000-000000000001', 'npc_nilo_01', 'benfica', 'benfica.court.01', 1, TRUE);
