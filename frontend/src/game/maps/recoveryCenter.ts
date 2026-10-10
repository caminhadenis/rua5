export type RecoveryMethod = 'REST' | 'ICE_BATH'
export interface RecoveryStation {
  id: string; method: RecoveryMethod; label: string; x: number; y: number
}

export const RECOVERY_CENTER_ID = 'benfica.recovery'
export const RECOVERY_STATIONS: RecoveryStation[] = [
  { id: 'benfica.recovery.bed.01', method: 'REST', label: 'Maca 1', x: 200, y: 225 },
  { id: 'benfica.recovery.bed.02', method: 'REST', label: 'Maca 2', x: 395, y: 225 },
  { id: 'benfica.recovery.bed.03', method: 'REST', label: 'Maca 3', x: 590, y: 225 },
  { id: 'benfica.recovery.ice.01', method: 'ICE_BATH', label: 'Banho de gelo 1', x: 775, y: 225 },
  { id: 'benfica.recovery.ice.02', method: 'ICE_BATH', label: 'Banho de gelo 2', x: 775, y: 375 },
]
