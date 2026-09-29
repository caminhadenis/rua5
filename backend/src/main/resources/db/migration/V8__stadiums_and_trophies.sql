CREATE TABLE trophy_definition (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    description TEXT NOT NULL
);
CREATE TABLE stadium (
    id VARCHAR(64) PRIMARY KEY,
    name VARCHAR(128) NOT NULL,
    type VARCHAR(24) NOT NULL CHECK (type = 'NEIGHBORHOOD'),
    map_id VARCHAR(64) NOT NULL,
    spawn_key VARCHAR(128) NOT NULL,
    difficulty INTEGER NOT NULL CHECK (difficulty BETWEEN 1 AND 15),
    keeper_base INTEGER NOT NULL CHECK (keeper_base BETWEEN 1 AND 99),
    trophy_id VARCHAR(64) NOT NULL UNIQUE REFERENCES trophy_definition(id),
    enabled BOOLEAN NOT NULL DEFAULT TRUE,
    UNIQUE (map_id, spawn_key),
    UNIQUE (id, trophy_id)
);
CREATE TABLE stadium_requirement (
    stadium_id VARCHAR(64) NOT NULL REFERENCES stadium(id),
    required_trophy_id VARCHAR(64) NOT NULL REFERENCES trophy_definition(id),
    PRIMARY KEY (stadium_id, required_trophy_id)
);
CREATE TABLE stadium_opponent_player (
    stadium_id VARCHAR(64) NOT NULL REFERENCES stadium(id),
    slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 1 AND 5),
    player_definition_id VARCHAR(64) NOT NULL REFERENCES player_definition(id),
    level INTEGER NOT NULL CHECK (level BETWEEN 1 AND 15),
    PRIMARY KEY (stadium_id, slot_index),
    UNIQUE (stadium_id, player_definition_id)
);
-- Preserve the challenger FK and old UUID identifiers; stadium sources have their own FK.
ALTER TABLE game_match ALTER COLUMN owned_player_id DROP NOT NULL;
ALTER TABLE game_match ALTER COLUMN source_id DROP NOT NULL;
ALTER TABLE game_match ADD COLUMN stadium_id VARCHAR(64) REFERENCES stadium(id);
ALTER TABLE game_match ADD COLUMN home_penalties INTEGER CHECK (home_penalties >= 0);
ALTER TABLE game_match ADD COLUMN away_penalties INTEGER CHECK (away_penalties >= 0);
ALTER TABLE game_match DROP CONSTRAINT game_match_mode_check;
ALTER TABLE game_match DROP CONSTRAINT game_match_source_type_check;
ALTER TABLE game_match DROP CONSTRAINT game_match_outcome_valid;
ALTER TABLE game_match ADD CONSTRAINT game_match_source_valid CHECK (
    (mode = 'DUEL_1V1' AND source_type = 'CHALLENGER' AND source_id IS NOT NULL AND owned_player_id IS NOT NULL AND stadium_id IS NULL) OR
    (mode = 'STADIUM_5V5' AND source_type = 'STADIUM' AND source_id IS NULL AND owned_player_id IS NULL AND stadium_id IS NOT NULL)
);
ALTER TABLE game_match ADD CONSTRAINT game_match_outcome_valid CHECK (
    (home_penalties IS NULL AND away_penalties IS NULL AND (
        (outcome = 'WIN' AND home_score > away_score) OR
        (outcome = 'LOSS' AND home_score < away_score) OR
        (mode = 'DUEL_1V1' AND outcome = 'DRAW' AND home_score = away_score)
    )) OR
    (mode = 'STADIUM_5V5' AND home_score = away_score AND home_penalties IS NOT NULL AND away_penalties IS NOT NULL AND (
        (outcome = 'WIN' AND home_penalties > away_penalties) OR
        (outcome = 'LOSS' AND home_penalties < away_penalties)
    ))
);
ALTER TABLE game_match ADD CONSTRAINT game_match_trophy_reference UNIQUE (profile_id, id, stadium_id, outcome);
CREATE TABLE user_trophy (
    profile_id UUID NOT NULL REFERENCES game_profile(id),
    trophy_id VARCHAR(64) NOT NULL REFERENCES trophy_definition(id),
    stadium_id VARCHAR(64) NOT NULL,
    match_id UUID NOT NULL,
    outcome VARCHAR(8) NOT NULL DEFAULT 'WIN' CHECK (outcome = 'WIN'),
    won_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (profile_id, trophy_id),
    UNIQUE (profile_id, stadium_id),
    FOREIGN KEY (stadium_id, trophy_id) REFERENCES stadium(id, trophy_id),
    FOREIGN KEY (profile_id, match_id, stadium_id, outcome) REFERENCES game_match(profile_id, id, stadium_id, outcome)
);

INSERT INTO trophy_definition VALUES ('trophy_benfica', 'Taça do Benfica', 'Conquistada no Estádio do Benfica.');
INSERT INTO stadium VALUES ('benfica_stadium', 'Estádio do Benfica', 'NEIGHBORHOOD', 'benfica', 'benfica.stadium.entry', 6, 35, 'trophy_benfica', TRUE);
INSERT INTO player_definition (id, name, archetype, preferred_role, rarity, speed, dribbling, passing, finishing, defending, physical, recruitable, starter, enabled) VALUES
('stadium_iris', 'Íris', 'MARKER', 'DEFENDER', 'COMMON', 52, 42, 55, 38, 68, 65, FALSE, FALSE, TRUE),
('stadium_tito', 'Tito', 'MARKER', 'DEFENDER', 'COMMON', 48, 45, 52, 40, 65, 70, FALSE, FALSE, TRUE),
('stadium_lia', 'Lia', 'PLAYMAKER', 'MIDFIELDER', 'COMMON', 56, 58, 72, 48, 50, 48, FALSE, FALSE, TRUE),
('stadium_ivo', 'Ivo', 'DRIBBLER', 'ATTACKER', 'COMMON', 70, 70, 50, 56, 35, 45, FALSE, FALSE, TRUE),
('stadium_mara', 'Mara', 'FINISHER', 'ATTACKER', 'COMMON', 56, 52, 45, 72, 35, 65, FALSE, FALSE, TRUE);
INSERT INTO stadium_opponent_player VALUES
('benfica_stadium', 1, 'stadium_iris', 6), ('benfica_stadium', 2, 'stadium_tito', 6),
('benfica_stadium', 3, 'stadium_lia', 6), ('benfica_stadium', 4, 'stadium_ivo', 6), ('benfica_stadium', 5, 'stadium_mara', 6);
