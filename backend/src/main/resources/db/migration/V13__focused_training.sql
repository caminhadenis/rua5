-- Focused training bonuses belong to the owned athlete, not the shared definition.
ALTER TABLE owned_player
    ADD COLUMN training_speed INTEGER NOT NULL DEFAULT 0 CHECK (training_speed BETWEEN 0 AND 98),
    ADD COLUMN training_dribbling INTEGER NOT NULL DEFAULT 0 CHECK (training_dribbling BETWEEN 0 AND 98),
    ADD COLUMN training_passing INTEGER NOT NULL DEFAULT 0 CHECK (training_passing BETWEEN 0 AND 98),
    ADD COLUMN training_finishing INTEGER NOT NULL DEFAULT 0 CHECK (training_finishing BETWEEN 0 AND 98),
    ADD COLUMN training_defending INTEGER NOT NULL DEFAULT 0 CHECK (training_defending BETWEEN 0 AND 98),
    ADD COLUMN training_physical INTEGER NOT NULL DEFAULT 0 CHECK (training_physical BETWEEN 0 AND 98);

-- Existing XP sessions remain replayable with their original receipt. New sessions record the focused change.
ALTER TABLE training_session
    ADD COLUMN stat_before INTEGER CHECK (stat_before BETWEEN 1 AND 99),
    ADD COLUMN stat_after INTEGER CHECK (stat_after BETWEEN 1 AND 99),
    ADD CONSTRAINT training_stat_pair CHECK ((stat_before IS NULL) = (stat_after IS NULL));

-- The cooldown now applies to the whole profile. The profile row lock serializes starts.
DROP INDEX training_session_player_time;
CREATE INDEX training_session_profile_time ON training_session (profile_id, trained_at DESC);
