CREATE TABLE app_user (
    id UUID PRIMARY KEY,
    email VARCHAR(254) NOT NULL UNIQUE,
    password_hash VARCHAR(100) NOT NULL,
    current_profile_id UUID REFERENCES game_profile(id),
    created_at TIMESTAMPTZ NOT NULL,
    updated_at TIMESTAMPTZ NOT NULL,
    CONSTRAINT app_user_email_normalized CHECK (email = lower(btrim(email)) AND char_length(email) > 0)
);

-- Legacy local profiles remain unclaimed. Only authenticated creation sets ownership.
ALTER TABLE game_profile ADD COLUMN user_id UUID REFERENCES app_user(id);
CREATE INDEX game_profile_user_id_idx ON game_profile(user_id);
-- The composite reference prevents an account from pointing at another account's save.
ALTER TABLE game_profile ADD CONSTRAINT game_profile_owner_unique UNIQUE (id, user_id);
ALTER TABLE app_user ADD CONSTRAINT app_user_current_profile_owned
    FOREIGN KEY (current_profile_id, id) REFERENCES game_profile(id, user_id);

CREATE TABLE new_game_command (
    owner_key VARCHAR(80) NOT NULL,
    idempotency_key UUID NOT NULL,
    display_name VARCHAR(40) NOT NULL,
    primary_color VARCHAR(7) NOT NULL,
    secondary_color VARCHAR(7) NOT NULL,
    profile_id UUID NOT NULL REFERENCES game_profile(id) ON DELETE CASCADE,
    created_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (owner_key, idempotency_key)
);
