ALTER TABLE owned_player
    ADD COLUMN fatigue DOUBLE PRECISION NOT NULL DEFAULT 0 CHECK (fatigue BETWEEN 0 AND 100),
    ADD COLUMN fatigue_updated_at TIMESTAMPTZ;
ALTER TABLE owned_player ADD CONSTRAINT fatigue_has_reference CHECK (fatigue = 0 OR fatigue_updated_at IS NOT NULL);

ALTER TABLE training_session
    ADD COLUMN cooldown_seconds INTEGER NOT NULL DEFAULT 60 CHECK (cooldown_seconds IN (60, 90, 120, 180)),
    ADD COLUMN fatigue_change JSONB;
-- Preserve the original receipt for training sessions predating focused attribute drills.
UPDATE training_session SET cooldown_seconds = 90 WHERE stat_before IS NULL;
