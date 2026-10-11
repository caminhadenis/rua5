import type { RosterPlayer } from '../../src/api/gameApi'

// Recovery continues across reloads. Compare the saved progression, not its time projection.
export function persistentRoster(players: RosterPlayer[]) {
  return players.map(player => Object.fromEntries(Object.entries(player).filter(([key]) => !['fatigue', 'matchStats', 'coachedMatchStats'].includes(key))))
}
