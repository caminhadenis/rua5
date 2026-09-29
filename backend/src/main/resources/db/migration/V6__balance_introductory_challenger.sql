-- Beginner encounter: approximately 7–8 wins in 10 for a level-one starter.
-- Only future snapshots use these stats; stored matches/rewards and player progression are unchanged.
UPDATE player_definition
SET speed = 40, dribbling = 40, passing = 40, finishing = 35, defending = 45, physical = 40
WHERE id = 'npc_nilo_01';
