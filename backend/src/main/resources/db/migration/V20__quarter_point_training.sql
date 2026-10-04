-- Bonuses are now stored as integer quarter points; preserve all earned whole points.
ALTER TABLE owned_player
    DROP CONSTRAINT owned_player_training_speed_check,
    ADD CONSTRAINT owned_player_training_speed_check CHECK (training_speed BETWEEN 0 AND 392),
    DROP CONSTRAINT owned_player_training_dribbling_check,
    ADD CONSTRAINT owned_player_training_dribbling_check CHECK (training_dribbling BETWEEN 0 AND 392),
    DROP CONSTRAINT owned_player_training_passing_check,
    ADD CONSTRAINT owned_player_training_passing_check CHECK (training_passing BETWEEN 0 AND 392),
    DROP CONSTRAINT owned_player_training_finishing_check,
    ADD CONSTRAINT owned_player_training_finishing_check CHECK (training_finishing BETWEEN 0 AND 392),
    DROP CONSTRAINT owned_player_training_defending_check,
    ADD CONSTRAINT owned_player_training_defending_check CHECK (training_defending BETWEEN 0 AND 392),
    DROP CONSTRAINT owned_player_training_physical_check,
    ADD CONSTRAINT owned_player_training_physical_check CHECK (training_physical BETWEEN 0 AND 392);

UPDATE owned_player SET
    training_speed = training_speed * 4,
    training_dribbling = training_dribbling * 4,
    training_passing = training_passing * 4,
    training_finishing = training_finishing * 4,
    training_defending = training_defending * 4,
    training_physical = training_physical * 4;

-- Quarter points have an exact binary representation. Historical integer receipts remain valid.
ALTER TABLE training_session
    ALTER COLUMN stat_before TYPE DOUBLE PRECISION,
    ALTER COLUMN stat_after TYPE DOUBLE PRECISION,
    ADD CONSTRAINT training_stat_before_quarters CHECK (stat_before * 4 = trunc(stat_before * 4)),
    ADD CONSTRAINT training_stat_after_quarters CHECK (stat_after * 4 = trunc(stat_after * 4));
