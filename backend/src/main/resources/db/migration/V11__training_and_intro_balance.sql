-- Training is profile-owned progression. The unique command key makes retries safe.
CREATE TABLE training_session (
    profile_id UUID NOT NULL REFERENCES game_profile(id) ON DELETE CASCADE,
    idempotency_key UUID NOT NULL,
    owned_player_id UUID NOT NULL REFERENCES owned_player(id) ON DELETE CASCADE,
    focus VARCHAR(16) NOT NULL CHECK (focus IN ('SPEED', 'DRIBBLING', 'PASSING', 'FINISHING', 'DEFENDING', 'PHYSICAL')),
    xp_awarded INTEGER NOT NULL CHECK (xp_awarded >= 0),
    previous_level INTEGER NOT NULL,
    current_level INTEGER NOT NULL,
    previous_xp INTEGER NOT NULL,
    current_xp INTEGER NOT NULL,
    trained_at TIMESTAMPTZ NOT NULL,
    PRIMARY KEY (profile_id, idempotency_key)
);
CREATE INDEX training_session_player_time ON training_session (owned_player_id, trained_at DESC);

-- Future duels and recruits use the gentler curve; historical match snapshots stay intact.
UPDATE challenger SET level = CASE player_definition_id
    WHEN 'npc_cora_01' THEN 1 WHEN 'npc_davi_01' THEN 1
    WHEN 'npc_bia_01' THEN 2 WHEN 'npc_rui_01' THEN 2
    WHEN 'npc_sol_01' THEN 3 WHEN 'npc_teca_01' THEN 4
    WHEN 'npc_zeca_01' THEN 5 ELSE level END
WHERE map_id = 'benfica';
UPDATE player_definition SET
    speed = 46, dribbling = 46, passing = 60, finishing = 42, defending = 43, physical = 43
WHERE id = 'npc_cora_01';
UPDATE player_definition SET
    speed = 48, dribbling = 44, passing = 42, finishing = 60, defending = 36, physical = 52
WHERE id = 'npc_davi_01';
UPDATE player_definition SET
    speed = 60, dribbling = 61, passing = 46, finishing = 47, defending = 38, physical = 44
WHERE id = 'npc_bia_01';
