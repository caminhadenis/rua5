ALTER TABLE owned_player ADD COLUMN roster_active BOOLEAN NOT NULL DEFAULT TRUE;
ALTER TABLE challenger ADD COLUMN profile_id UUID REFERENCES game_profile(id) ON DELETE CASCADE;

-- Retain historical owned rows, matches, training and unique player identities.
CREATE TABLE released_player (
    owned_player_id UUID PRIMARY KEY REFERENCES owned_player(id) ON DELETE CASCADE,
    profile_id UUID NOT NULL REFERENCES game_profile(id) ON DELETE CASCADE,
    challenger_id UUID NOT NULL REFERENCES challenger(id) ON DELETE CASCADE,
    map_id VARCHAR(64) NOT NULL CHECK (map_id = 'benfica'),
    x DOUBLE PRECISION NOT NULL CHECK (x BETWEEN 16 AND 2288),
    y DOUBLE PRECISION NOT NULL CHECK (y BETWEEN 16 AND 1584),
    UNIQUE (profile_id, challenger_id)
);
CREATE TABLE dismissal_command (
    profile_id UUID NOT NULL REFERENCES game_profile(id) ON DELETE CASCADE,
    idempotency_key UUID NOT NULL,
    owned_player_id UUID NOT NULL REFERENCES owned_player(id) ON DELETE CASCADE,
    challenger_id UUID NOT NULL REFERENCES challenger(id) ON DELETE CASCADE,
    map_id VARCHAR(64) NOT NULL,
    x DOUBLE PRECISION NOT NULL,
    y DOUBLE PRECISION NOT NULL,
    PRIMARY KEY (profile_id, idempotency_key)
);

-- Existing large rosters are preserved; inserts/reactivations cannot grow them.
CREATE FUNCTION enforce_roster_capacity() RETURNS trigger LANGUAGE plpgsql AS $$
BEGIN
    IF NEW.roster_active AND (TG_OP = 'INSERT' OR NOT OLD.roster_active OR OLD.profile_id <> NEW.profile_id) THEN
        PERFORM id FROM game_profile WHERE id = NEW.profile_id FOR UPDATE;
        IF (SELECT count(*) FROM owned_player WHERE profile_id = NEW.profile_id AND roster_active AND id <> NEW.id) >= 5 THEN
            RAISE EXCEPTION 'Roster capacity exceeded' USING ERRCODE = '23514';
        END IF;
    END IF;
    RETURN NEW;
END;
$$;
CREATE TRIGGER roster_capacity BEFORE INSERT OR UPDATE ON owned_player
    FOR EACH ROW EXECUTE FUNCTION enforce_roster_capacity();

ALTER TABLE challenger_progress ADD COLUMN recruitment_by_dismissal BOOLEAN NOT NULL DEFAULT FALSE;
ALTER TABLE challenger_progress DROP CONSTRAINT challenger_progress_recruitment_requires_win;
ALTER TABLE challenger_progress ADD CONSTRAINT challenger_progress_recruitment_requires_win
    CHECK (recruitment_status = 'LOCKED' OR wins > 0 OR recruitment_by_dismissal);
