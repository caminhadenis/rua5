-- Keep definition IDs, ownership and historical match snapshots intact.
-- The stadium defender remains Íris; the east-court dribbler is now Estela.
UPDATE player_definition SET name = 'Estela' WHERE id = 'npc_iris_01';
