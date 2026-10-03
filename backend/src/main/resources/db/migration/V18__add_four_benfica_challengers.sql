-- Add four more encounters across the north, west, east and southeast of Benfica.
INSERT INTO player_definition (
    id, name, archetype, preferred_role, rarity,
    speed, dribbling, passing, finishing, defending, physical, recruitable, starter, enabled
) VALUES
('npc_nina_01', 'Nina', 'PLAYMAKER', 'MIDFIELDER', 'COMMON', 58, 57, 63, 52, 51, 50, TRUE, FALSE, TRUE),
('npc_beto_01', 'Beto', 'MARKER', 'DEFENDER', 'COMMON', 54, 50, 53, 46, 62, 61, TRUE, FALSE, TRUE),
('npc_joca_01', 'Joca', 'DRIBBLER', 'ATTACKER', 'COMMON', 64, 66, 51, 55, 42, 49, TRUE, FALSE, TRUE),
('npc_maiara_01', 'Maiara', 'FINISHER', 'ATTACKER', 'COMMON', 61, 57, 54, 65, 47, 57, TRUE, FALSE, TRUE);

INSERT INTO challenger (id, player_definition_id, map_id, spawn_key, level, enabled) VALUES
('00000000-0000-4000-8000-000000000013', 'npc_nina_01', 'benfica', 'benfica.court.13', 2, TRUE),
('00000000-0000-4000-8000-000000000014', 'npc_beto_01', 'benfica', 'benfica.court.14', 1, TRUE),
('00000000-0000-4000-8000-000000000015', 'npc_joca_01', 'benfica', 'benfica.court.15', 3, TRUE),
('00000000-0000-4000-8000-000000000016', 'npc_maiara_01', 'benfica', 'benfica.court.16', 4, TRUE);
