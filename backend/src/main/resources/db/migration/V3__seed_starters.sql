INSERT INTO player_definition (
    id,
    name,
    archetype,
    preferred_role,
    rarity,
    speed,
    dribbling,
    passing,
    finishing,
    defending,
    physical,
    recruitable,
    starter,
    enabled
) VALUES
    ('starter_leo', 'Leo', 'DRIBBLER', 'ATTACKER', 'COMMON', 74, 80, 62, 58, 40, 52, FALSE, TRUE, TRUE),
    ('starter_rafa', 'Rafa', 'FINISHER', 'ATTACKER', 'COMMON', 64, 61, 55, 81, 39, 72, FALSE, TRUE, TRUE),
    ('starter_breno', 'Breno', 'PLAYMAKER', 'MIDFIELDER', 'COMMON', 58, 62, 77, 55, 70, 66, FALSE, TRUE, TRUE);
