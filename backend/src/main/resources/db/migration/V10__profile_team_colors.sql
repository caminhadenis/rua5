-- Existing profiles retain the original yellow/navy uniform.
ALTER TABLE game_profile
    ADD COLUMN primary_color varchar(7) NOT NULL DEFAULT '#f7d154',
    ADD COLUMN secondary_color varchar(7) NOT NULL DEFAULT '#24354a',
    ADD CONSTRAINT game_profile_primary_color_valid CHECK (primary_color ~ '^#[0-9a-f]{6}$'),
    ADD CONSTRAINT game_profile_secondary_color_valid CHECK (secondary_color ~ '^#[0-9a-f]{6}$');
