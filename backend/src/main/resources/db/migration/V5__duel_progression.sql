CREATE TABLE challenger_progress (
    profile_id UUID NOT NULL REFERENCES game_profile(id) ON DELETE CASCADE,
    challenger_id UUID NOT NULL REFERENCES challenger(id),
    attempts INTEGER NOT NULL DEFAULT 0 CHECK (attempts >= 0),
    wins INTEGER NOT NULL DEFAULT 0 CHECK (wins >= 0),
    draws INTEGER NOT NULL DEFAULT 0 CHECK (draws >= 0),
    losses INTEGER NOT NULL DEFAULT 0 CHECK (losses >= 0),
    last_played_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (profile_id, challenger_id),
    CHECK (attempts = wins + draws + losses)
);

-- M3 matches have no rewards. Historical retries must never grant XP retroactively.
ALTER TABLE game_match ADD COLUMN rewards JSONB CHECK (rewards IS NULL OR jsonb_typeof(rewards) = 'object');
