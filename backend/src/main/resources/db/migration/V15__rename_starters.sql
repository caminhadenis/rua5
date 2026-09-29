UPDATE player_definition
SET name = CASE id
        WHEN 'starter_leo' THEN 'Cabeleira'
        WHEN 'starter_breno' THEN 'Aderlou'
        WHEN 'starter_rafa' THEN 'Loraco'
    END,
    archetype = CASE id
        WHEN 'starter_leo' THEN 'PLAYMAKER'
        WHEN 'starter_breno' THEN 'MARKER'
        WHEN 'starter_rafa' THEN 'FINISHER'
    END,
    speed = CASE id
        WHEN 'starter_leo' THEN 74
        WHEN 'starter_breno' THEN 58
        WHEN 'starter_rafa' THEN 72
    END,
    dribbling = CASE id
        WHEN 'starter_leo' THEN 70
        WHEN 'starter_breno' THEN 62
        WHEN 'starter_rafa' THEN 61
    END,
    passing = CASE id
        WHEN 'starter_leo' THEN 77
        WHEN 'starter_breno' THEN 62
        WHEN 'starter_rafa' THEN 55
    END,
    finishing = CASE id
        WHEN 'starter_leo' THEN 58
        WHEN 'starter_breno' THEN 55
        WHEN 'starter_rafa' THEN 81
    END,
    defending = CASE id
        WHEN 'starter_leo' THEN 48
        WHEN 'starter_breno' THEN 78
        WHEN 'starter_rafa' THEN 39
    END,
    physical = CASE id
        WHEN 'starter_leo' THEN 52
        WHEN 'starter_breno' THEN 66
        WHEN 'starter_rafa' THEN 62
    END
WHERE id IN ('starter_leo', 'starter_breno', 'starter_rafa');
