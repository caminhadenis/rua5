/** Local editing only. Ownership and persistence are validated again by the server. */
export function assignSlot(slots: readonly (string | null)[], index: number, playerId: string | null): (string | null)[] {
  if (slots.length !== 5 || !Number.isInteger(index) || index < 0 || index >= 5) throw new Error('Slot inválido')
  return slots.map((id, slot) => slot === index ? playerId : playerId !== null && id === playerId ? null : id)
}
