-- New sessions are immediately available. Preserve historical receipt delays for idempotent replay.
ALTER TABLE training_session DROP CONSTRAINT training_session_cooldown_seconds_check;
ALTER TABLE training_session ADD CONSTRAINT training_session_cooldown_seconds_check
    CHECK (cooldown_seconds IN (0, 60, 90, 120, 180));
ALTER TABLE training_session ALTER COLUMN cooldown_seconds SET DEFAULT 0;
