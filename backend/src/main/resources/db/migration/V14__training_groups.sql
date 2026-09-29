-- One partial five-session group per owned athlete and focus. Existing V13 bonuses stay earned.
CREATE TABLE owned_player_training_progress (
    owned_player_id UUID NOT NULL REFERENCES owned_player(id) ON DELETE CASCADE,
    focus VARCHAR(16) NOT NULL CHECK (focus IN ('SPEED', 'DRIBBLING', 'PASSING', 'FINISHING', 'DEFENDING', 'PHYSICAL')),
    sessions_completed SMALLINT NOT NULL DEFAULT 0 CHECK (sessions_completed BETWEEN 0 AND 4),
    PRIMARY KEY (owned_player_id, focus)
);

-- Nullable for historical XP/+1 sessions so retries keep their original reward.
ALTER TABLE training_session
    ADD COLUMN progress_before SMALLINT CHECK (progress_before BETWEEN 0 AND 4),
    ADD COLUMN progress_after SMALLINT CHECK (progress_after BETWEEN 0 AND 4),
    ADD CONSTRAINT training_progress_pair CHECK ((progress_before IS NULL) = (progress_after IS NULL));
