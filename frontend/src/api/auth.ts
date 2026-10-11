export interface AuthStatus {
  enabled: boolean; authenticated: boolean; email: string | null
  csrfToken: string | null; csrfHeader: string | null
}

let csrf: Pick<AuthStatus, 'csrfToken' | 'csrfHeader'> | undefined

export function csrfHeaders(): Record<string, string> {
  return csrf?.csrfToken && csrf.csrfHeader ? { [csrf.csrfHeader]: csrf.csrfToken } : {}
}

export async function loadAuth(): Promise<AuthStatus> {
  const response = await fetch('/api/v1/auth', { credentials: 'same-origin', signal: AbortSignal.timeout(90_000) })
  if (!response.ok) throw new Error('Não foi possível conectar ao jogo. Tente novamente.')
  const status = await response.json() as AuthStatus
  csrf = status
  return status
}

async function authCommand(path: string, body?: BodyInit, contentType?: string): Promise<void> {
  const response = await fetch(`/api/v1/auth/${path}`, {
    method: 'POST', credentials: 'same-origin', signal: AbortSignal.timeout(15_000),
    headers: { ...csrfHeaders(), ...(contentType ? { 'Content-Type': contentType } : {}) }, body,
  })
  if (!response.ok) {
    const error = await response.json().catch(() => ({})) as { message?: string }
    throw new Error(error.message ?? 'Não foi possível entrar. Tente novamente.')
  }
}

export async function signIn(email: string, password: string, register = false): Promise<AuthStatus> {
  // Refresh after a failed login too: session expiry can invalidate the earlier token.
  await loadAuth()
  if (register) await authCommand('register', JSON.stringify({ email, password }), 'application/json')
  await authCommand('login', new URLSearchParams({ email, password }), 'application/x-www-form-urlencoded')
  // Successful authentication rotates the session ID and clears the old CSRF token.
  return loadAuth()
}

export async function signOut(): Promise<void> {
  await loadAuth()
  await authCommand('logout')
  csrf = undefined
}
