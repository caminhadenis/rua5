/** Reveal a goal only after the shot animation reaches the net. */
export function onGoalArrival(ball: HTMLElement, reveal: () => void): () => void {
  let pending = true
  const arrive = () => {
    if (!pending) return
    cancel()
    reveal()
  }
  const fallback = window.setTimeout(arrive, 900)
  ball.addEventListener('animationend', arrive)
  const cancel = () => {
    pending = false
    window.clearTimeout(fallback)
    ball.removeEventListener('animationend', arrive)
  }
  return cancel
}
