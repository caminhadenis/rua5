-- M7: complete only the existing neighborhood. Base stats and authored spawn IDs are stable.
INSERT INTO player_definition (id, name, archetype, preferred_role, rarity, speed, dribbling, passing, finishing, defending, physical, recruitable, starter, enabled) VALUES
('npc_cora_01', 'Cora', 'PLAYMAKER', 'MIDFIELDER', 'COMMON', 49, 50, 65, 44, 48, 45, TRUE, FALSE, TRUE),
('npc_davi_01', 'Davi', 'FINISHER', 'ATTACKER', 'COMMON', 52, 48, 43, 65, 38, 58, TRUE, FALSE, TRUE),
('npc_bia_01', 'Bia', 'DRIBBLER', 'ATTACKER', 'COMMON', 65, 66, 49, 50, 40, 46, TRUE, FALSE, TRUE),
('npc_rui_01', 'Rui', 'MARKER', 'DEFENDER', 'COMMON', 50, 46, 53, 42, 70, 66, TRUE, FALSE, TRUE),
('npc_sol_01', 'Sol', 'PLAYMAKER', 'MIDFIELDER', 'COMMON', 55, 60, 72, 51, 53, 50, TRUE, FALSE, TRUE),
('npc_teca_01', 'Teca', 'FINISHER', 'ATTACKER', 'UNCOMMON', 59, 58, 48, 75, 42, 67, TRUE, FALSE, TRUE),
('npc_zeca_01', 'Zeca', 'DRIBBLER', 'ATTACKER', 'UNCOMMON', 73, 76, 58, 62, 48, 55, TRUE, FALSE, TRUE);

INSERT INTO challenger (id, player_definition_id, map_id, spawn_key, level) VALUES
('00000000-0000-4000-8000-000000000002', 'npc_cora_01', 'benfica', 'benfica.court.02', 2),
('00000000-0000-4000-8000-000000000003', 'npc_davi_01', 'benfica', 'benfica.court.03', 2),
('00000000-0000-4000-8000-000000000004', 'npc_bia_01', 'benfica', 'benfica.court.04', 3),
('00000000-0000-4000-8000-000000000005', 'npc_rui_01', 'benfica', 'benfica.court.05', 4),
('00000000-0000-4000-8000-000000000006', 'npc_sol_01', 'benfica', 'benfica.court.06', 4),
('00000000-0000-4000-8000-000000000007', 'npc_teca_01', 'benfica', 'benfica.court.07', 5),
('00000000-0000-4000-8000-000000000008', 'npc_zeca_01', 'benfica', 'benfica.court.08', 6);
