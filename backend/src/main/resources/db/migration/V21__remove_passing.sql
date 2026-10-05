-- All new matches are individual duels. Retire the unused attribute and drills.
ALTER TABLE player_definition DROP COLUMN passing;
ALTER TABLE owned_player DROP COLUMN training_passing;

DELETE FROM owned_player_training_progress WHERE focus = 'PASSING';
DELETE FROM training_session WHERE focus = 'PASSING';
ALTER TABLE owned_player_training_progress DROP CONSTRAINT owned_player_training_progress_focus_check;
ALTER TABLE owned_player_training_progress ADD CONSTRAINT owned_player_training_progress_focus_check
    CHECK (focus IN ('SPEED', 'DRIBBLING', 'FINISHING', 'DEFENDING', 'PHYSICAL'));
ALTER TABLE training_session DROP CONSTRAINT training_session_focus_check;
ALTER TABLE training_session ADD CONSTRAINT training_session_focus_check
    CHECK (focus IN ('SPEED', 'DRIBBLING', 'FINISHING', 'DEFENDING', 'PHYSICAL'));

-- Keep participant identity, all other stats and saved opponent order intact.
CREATE FUNCTION remove_retired_stat(participants JSONB) RETURNS JSONB
LANGUAGE SQL IMMUTABLE AS $$
    SELECT COALESCE(jsonb_agg(participant #- '{stats,passing}' ORDER BY position), '[]'::jsonb)
    FROM jsonb_array_elements(participants) WITH ORDINALITY AS p(participant, position)
$$;

UPDATE game_match SET request_snapshot = jsonb_set(
    jsonb_set(request_snapshot, '{home}', remove_retired_stat(request_snapshot -> 'home')),
    '{away}', remove_retired_stat(request_snapshot -> 'away')
);
UPDATE stadium_series SET opponents = remove_retired_stat(opponents);
DROP FUNCTION remove_retired_stat(JSONB);

-- Retire only legacy pass events. Scores, penalties, statistics and rewards stay saved.
UPDATE game_match SET events = (
    SELECT COALESCE(jsonb_agg(jsonb_set(event, '{sequence}', to_jsonb(sequence)) ORDER BY sequence), '[]'::jsonb)
    FROM (
        SELECT event, row_number() OVER (ORDER BY position) AS sequence
        FROM jsonb_array_elements(events) WITH ORDINALITY AS e(event, position)
        WHERE event ->> 'type' <> 'PASS'
    ) retained
) WHERE events @> '[{"type":"PASS"}]'::jsonb;
