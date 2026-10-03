CREATE TABLE stadium_series (
    id UUID PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES game_profile(id),
    stadium_id VARCHAR(64) NOT NULL REFERENCES stadium(id),
    opponents JSONB NOT NULL CHECK (jsonb_array_length(opponents) = 5),
    played INTEGER NOT NULL DEFAULT 0 CHECK (played BETWEEN 0 AND 5),
    wins INTEGER NOT NULL DEFAULT 0 CHECK (wins BETWEEN 0 AND played),
    finished BOOLEAN NOT NULL DEFAULT FALSE,
    won BOOLEAN GENERATED ALWAYS AS (played = 5 AND wins = 5) STORED,
    created_at TIMESTAMPTZ NOT NULL,
    CHECK ((NOT finished AND played = wins AND played < 5) OR
           (finished AND ((played = 5 AND wins = 5) OR played = wins + 1))),
    UNIQUE (profile_id, id, stadium_id),
    UNIQUE (profile_id, id, stadium_id, won)
);
-- Latest attempt lookup used by GET and the locked match command.
CREATE INDEX stadium_series_latest ON stadium_series(profile_id, stadium_id, created_at DESC);
ALTER TABLE game_match ADD COLUMN series_id UUID;
ALTER TABLE game_match ADD COLUMN expected_series_id UUID REFERENCES stadium_series(id);
ALTER TABLE game_match ADD COLUMN round_number INTEGER CHECK (round_number BETWEEN 1 AND 5);
ALTER TABLE game_match ADD CONSTRAINT game_match_series_fk
    FOREIGN KEY (profile_id, series_id, stadium_id) REFERENCES stadium_series(profile_id, id, stadium_id);
ALTER TABLE game_match ADD CONSTRAINT game_match_series_round UNIQUE (series_id, round_number);
ALTER TABLE game_match DROP CONSTRAINT game_match_source_valid;
ALTER TABLE game_match ADD CONSTRAINT game_match_source_valid CHECK (
    (mode = 'DUEL_1V1' AND source_type = 'CHALLENGER' AND source_id IS NOT NULL AND owned_player_id IS NOT NULL AND stadium_id IS NULL AND series_id IS NULL AND round_number IS NULL) OR
    (mode = 'STADIUM_5V5' AND source_type = 'STADIUM' AND source_id IS NULL AND owned_player_id IS NULL AND stadium_id IS NOT NULL AND series_id IS NULL AND round_number IS NULL) OR
    (mode = 'STADIUM_1V1' AND source_type = 'STADIUM' AND source_id IS NULL AND owned_player_id IS NOT NULL AND stadium_id IS NOT NULL AND series_id IS NOT NULL AND round_number IS NOT NULL)
);
ALTER TABLE game_match DROP CONSTRAINT game_match_outcome_valid;
ALTER TABLE game_match ADD CONSTRAINT game_match_outcome_valid CHECK (
    (home_penalties IS NULL AND away_penalties IS NULL AND (
        (outcome = 'WIN' AND home_score > away_score) OR
        (outcome = 'LOSS' AND home_score < away_score) OR
        (mode = 'DUEL_1V1' AND outcome = 'DRAW' AND home_score = away_score)
    )) OR
    (mode IN ('STADIUM_5V5', 'STADIUM_1V1') AND home_score = away_score AND home_penalties IS NOT NULL AND away_penalties IS NOT NULL AND (
        (outcome = 'WIN' AND home_penalties > away_penalties) OR
        (outcome = 'LOSS' AND home_penalties < away_penalties)
    ))
);
ALTER TABLE user_trophy ADD COLUMN series_id UUID;
ALTER TABLE user_trophy ADD COLUMN series_won BOOLEAN NOT NULL DEFAULT TRUE CHECK (series_won);
ALTER TABLE user_trophy ADD CONSTRAINT user_trophy_series_won_fk
    FOREIGN KEY (profile_id, series_id, stadium_id, series_won) REFERENCES stadium_series(profile_id, id, stadium_id, won);
