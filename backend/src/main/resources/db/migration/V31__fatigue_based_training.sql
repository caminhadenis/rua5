-- Convert quarter-point counters to hundredths without changing any earned bonus.
ALTER TABLE owned_player
    DROP CONSTRAINT owned_player_training_speed_check,
    DROP CONSTRAINT owned_player_training_dribbling_check,
    DROP CONSTRAINT owned_player_training_finishing_check,
    DROP CONSTRAINT owned_player_training_defending_check,
    DROP CONSTRAINT owned_player_training_physical_check;

UPDATE owned_player SET
    training_speed = training_speed * 25,
    training_dribbling = training_dribbling * 25,
    training_finishing = training_finishing * 25,
    training_defending = training_defending * 25,
    training_physical = training_physical * 25;

ALTER TABLE owned_player
    ADD CONSTRAINT owned_player_training_speed_check CHECK (training_speed BETWEEN 0 AND 9800),
    ADD CONSTRAINT owned_player_training_dribbling_check CHECK (training_dribbling BETWEEN 0 AND 9800),
    ADD CONSTRAINT owned_player_training_finishing_check CHECK (training_finishing BETWEEN 0 AND 9800),
    ADD CONSTRAINT owned_player_training_defending_check CHECK (training_defending BETWEEN 0 AND 9800),
    ADD CONSTRAINT owned_player_training_physical_check CHECK (training_physical BETWEEN 0 AND 9800);

-- Existing quarter-point receipts keep their values; new gains may include hundredths.
ALTER TABLE training_session
    DROP CONSTRAINT training_stat_before_quarters,
    DROP CONSTRAINT training_stat_after_quarters,
    ALTER COLUMN stat_before TYPE NUMERIC(4, 2),
    ALTER COLUMN stat_after TYPE NUMERIC(4, 2);
