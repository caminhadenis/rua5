ALTER TABLE challenger_progress
    ADD COLUMN recruitment_status VARCHAR(16) NOT NULL DEFAULT 'LOCKED',
    ADD CONSTRAINT challenger_progress_recruitment_valid
        CHECK (recruitment_status IN ('LOCKED', 'AVAILABLE', 'RECRUITED')),
    ADD CONSTRAINT challenger_progress_recruitment_requires_win
        CHECK (recruitment_status = 'LOCKED' OR wins > 0);

-- Existing M4 wins are valid unlocks. M3 matches without progression/rewards are not.
UPDATE challenger_progress p SET recruitment_status = 'AVAILABLE'
FROM challenger c JOIN player_definition d ON d.id = c.player_definition_id
WHERE p.challenger_id = c.id AND p.wins > 0 AND d.recruitable
AND EXISTS (
    SELECT 1 FROM game_match m WHERE m.profile_id = p.profile_id
    AND m.source_id = p.challenger_id AND m.outcome = 'WIN' AND m.rewards IS NOT NULL
);

-- Composite FK enforces ownership even when writes bypass the application.
ALTER TABLE owned_player ADD CONSTRAINT owned_player_profile_id_unique UNIQUE (profile_id, id);
CREATE TABLE user_lineup (
    profile_id UUID NOT NULL REFERENCES game_profile(id) ON DELETE CASCADE,
    slot_index INTEGER NOT NULL CHECK (slot_index BETWEEN 1 AND 5),
    owned_player_id UUID NOT NULL,
    PRIMARY KEY (profile_id, slot_index),
    UNIQUE (profile_id, owned_player_id),
    FOREIGN KEY (profile_id, owned_player_id) REFERENCES owned_player(profile_id, id) ON DELETE CASCADE
);
