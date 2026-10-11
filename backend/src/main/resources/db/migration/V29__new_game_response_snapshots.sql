ALTER TABLE new_game_command ADD COLUMN profile_snapshot JSONB;

-- Backfill receipts from their original creation settings, without switching saves.
UPDATE new_game_command command
SET profile_snapshot = jsonb_build_object(
    'id', profile.id,
    'displayName', profile.display_name,
    'starterSelected', false,
    'primaryColor', profile.primary_color,
    'secondaryColor', profile.secondary_color,
    'currentMapId', null,
    'currentSpawnKey', null,
    'createdAt', profile.created_at,
    'updatedAt', profile.created_at
)
FROM game_profile profile WHERE profile.id = command.profile_id;

ALTER TABLE new_game_command ALTER COLUMN profile_snapshot SET NOT NULL;
