ALTER TABLE owned_player
    ADD COLUMN recovery_session_id UUID,
    ADD COLUMN recovery_station_id VARCHAR(64),
    ADD COLUMN recovery_method VARCHAR(16),
    ADD COLUMN recovery_ends_at TIMESTAMPTZ,
    ADD CONSTRAINT owned_player_recovery_complete CHECK (
        (num_nonnulls(recovery_session_id, recovery_station_id, recovery_method, recovery_ends_at) = 0)
        OR (num_nonnulls(recovery_session_id, recovery_station_id, recovery_method, recovery_ends_at) = 4
            AND recovery_method IN ('REST', 'ICE_BATH') AND recovery_ends_at IS NOT NULL AND fatigue_updated_at IS NOT NULL)
    );

CREATE TABLE recovery_session (
    id UUID PRIMARY KEY,
    profile_id UUID NOT NULL REFERENCES game_profile(id) ON DELETE CASCADE,
    owned_player_id UUID NOT NULL REFERENCES owned_player(id) ON DELETE CASCADE,
    station_id VARCHAR(64) NOT NULL CHECK (station_id IN (
        'benfica.recovery.bed.01', 'benfica.recovery.bed.02', 'benfica.recovery.bed.03',
        'benfica.recovery.ice.01', 'benfica.recovery.ice.02')),
    method VARCHAR(16) NOT NULL CHECK (method IN ('REST', 'ICE_BATH')),
    started_at TIMESTAMPTZ NOT NULL,
    completes_at TIMESTAMPTZ NOT NULL CHECK (completes_at >= started_at),
    cancelled_at TIMESTAMPTZ
);
ALTER TABLE owned_player ADD CONSTRAINT owned_player_recovery_session_fk
    FOREIGN KEY (recovery_session_id) REFERENCES recovery_session(id);

CREATE TABLE recovery_command (
    profile_id UUID NOT NULL REFERENCES game_profile(id) ON DELETE CASCADE,
    idempotency_key UUID NOT NULL,
    action VARCHAR(16) NOT NULL CHECK (action IN ('START', 'CANCEL')),
    target_id UUID NOT NULL,
    station_id VARCHAR(64),
    receipt JSONB NOT NULL,
    PRIMARY KEY (profile_id, idempotency_key)
);

-- The south trail is part of Benfica; preserve all existing released-player positions.
ALTER TABLE released_player DROP CONSTRAINT released_player_y_check;
ALTER TABLE released_player ADD CONSTRAINT released_player_y_check CHECK (y BETWEEN 16 AND 2672);
