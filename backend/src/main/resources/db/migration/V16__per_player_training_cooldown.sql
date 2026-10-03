-- Each cooldown lookup is scoped to the owned athlete being trained.
CREATE INDEX training_session_player_time ON training_session (owned_player_id, trained_at DESC);
