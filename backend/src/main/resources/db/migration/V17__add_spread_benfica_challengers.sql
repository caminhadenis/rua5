-- Add optional early and mid-game duels across the existing neighborhood.
INSERT INTO player_definition (
    id, name, archetype, preferred_role, rarity,
    speed, dribbling, passing, finishing, defending, physical, recruitable, starter, enabled
) VALUES
('npc_iris_01', 'Íris', 'DRIBBLER', 'ATTACKER', 'COMMON', 61, 64, 52, 54, 43, 48, TRUE, FALSE, TRUE),
('npc_bento_01', 'Bento', 'MARKER', 'DEFENDER', 'COMMON', 52, 48, 55, 47, 63, 60, TRUE, FALSE, TRUE),
('npc_lua_01', 'Lua', 'PLAYMAKER', 'MIDFIELDER', 'COMMON', 56, 58, 64, 51, 50, 49, TRUE, FALSE, TRUE),
('npc_caue_01', 'Cauê', 'FINISHER', 'ATTACKER', 'COMMON', 60, 54, 50, 62, 45, 56, TRUE, FALSE, TRUE);

INSERT INTO challenger (id, player_definition_id, map_id, spawn_key, level, enabled) VALUES
('00000000-0000-4000-8000-000000000009', 'npc_iris_01', 'benfica', 'benfica.court.09', 2, TRUE),
('00000000-0000-4000-8000-000000000010', 'npc_bento_01', 'benfica', 'benfica.court.10', 1, TRUE),
('00000000-0000-4000-8000-000000000011', 'npc_lua_01', 'benfica', 'benfica.court.11', 3, TRUE),
('00000000-0000-4000-8000-000000000012', 'npc_caue_01', 'benfica', 'benfica.court.12', 2, TRUE);
