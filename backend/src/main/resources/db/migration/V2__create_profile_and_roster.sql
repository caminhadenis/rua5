CREATE TABLE game_profile (
    id UUID PRIMARY KEY,
    display_name VARCHAR(40) NOT NULL,
    starter_selected BOOLEAN NOT NULL DEFAULT FALSE,
    current_map_id VARCHAR(64),
    current_spawn_key VARCHAR(128),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT game_profile_display_name_not_blank
        CHECK (char_length(btrim(display_name)) BETWEEN 1 AND 40)
);

CREATE TABLE player_definition (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(80) NOT NULL,
    archetype VARCHAR(24) NOT NULL,
    preferred_role VARCHAR(24) NOT NULL,
    rarity VARCHAR(24) NOT NULL,
    speed INTEGER NOT NULL,
    dribbling INTEGER NOT NULL,
    passing INTEGER NOT NULL,
    finishing INTEGER NOT NULL,
    defending INTEGER NOT NULL,
    physical INTEGER NOT NULL,
    recruitable BOOLEAN NOT NULL DEFAULT FALSE,
    starter BOOLEAN NOT NULL DEFAULT FALSE,
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT player_definition_id_not_blank CHECK (char_length(btrim(id)) > 0),
    CONSTRAINT player_definition_name_not_blank CHECK (char_length(btrim(name)) > 0),
    CONSTRAINT player_definition_archetype_valid
        CHECK (archetype IN ('DRIBBLER', 'FINISHER', 'PLAYMAKER', 'MARKER')),
    CONSTRAINT player_definition_preferred_role_valid
        CHECK (preferred_role IN ('DEFENDER', 'MIDFIELDER', 'ATTACKER')),
    CONSTRAINT player_definition_rarity_valid
        CHECK (rarity IN ('COMMON', 'UNCOMMON', 'RARE')),
    CONSTRAINT player_definition_speed_valid CHECK (speed BETWEEN 1 AND 99),
    CONSTRAINT player_definition_dribbling_valid CHECK (dribbling BETWEEN 1 AND 99),
    CONSTRAINT player_definition_passing_valid CHECK (passing BETWEEN 1 AND 99),
    CONSTRAINT player_definition_finishing_valid CHECK (finishing BETWEEN 1 AND 99),
    CONSTRAINT player_definition_defending_valid CHECK (defending BETWEEN 1 AND 99),
    CONSTRAINT player_definition_physical_valid CHECK (physical BETWEEN 1 AND 99)
);

CREATE TABLE owned_player (
    id UUID PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES game_profile(id) ON DELETE CASCADE,
    player_definition_id VARCHAR(64) NOT NULL REFERENCES player_definition(id),
    level INTEGER NOT NULL DEFAULT 1,
    xp INTEGER NOT NULL DEFAULT 0,
    wins INTEGER NOT NULL DEFAULT 0,
    draws INTEGER NOT NULL DEFAULT 0,
    losses INTEGER NOT NULL DEFAULT 0,
    recruited_at TIMESTAMPTZ NOT NULL,
    version BIGINT NOT NULL DEFAULT 0,
    CONSTRAINT owned_player_profile_definition_unique
        UNIQUE (profile_id, player_definition_id),
    CONSTRAINT owned_player_level_valid CHECK (level BETWEEN 1 AND 15),
    CONSTRAINT owned_player_xp_valid CHECK (xp >= 0),
    CONSTRAINT owned_player_wins_valid CHECK (wins >= 0),
    CONSTRAINT owned_player_draws_valid CHECK (draws >= 0),
    CONSTRAINT owned_player_losses_valid CHECK (losses >= 0)
);
