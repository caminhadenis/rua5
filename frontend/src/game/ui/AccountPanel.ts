import { signIn, type AuthStatus } from '../../api/auth'
import { button, paragraph } from './ScenePanel'

export function accountPanel(parent: HTMLElement, onAuthenticated: (status: AuthStatus) => void): void {
  const form = document.createElement('form')
  form.className = 'account-form'
  form.setAttribute('aria-label', 'Conta Rua 5')
  paragraph(form, 'Entre para salvar sua jornada e continuar em outro aparelho.')
  const emailLabel = document.createElement('label')
  emailLabel.textContent = 'E-mail'
  const email = document.createElement('input')
  email.type = 'email'; email.required = true; email.maxLength = 254; email.autocomplete = 'email'
  emailLabel.append(email)
  const passwordLabel = document.createElement('label')
  passwordLabel.textContent = 'Senha'
  const password = document.createElement('input')
  password.type = 'password'; password.required = true; password.maxLength = 72; password.autocomplete = 'current-password'
  passwordLabel.append(password)
  form.append(emailLabel, passwordLabel)
  const status = paragraph(form, '')
  status.setAttribute('role', 'status')
  const submit = async (register: boolean) => {
    if (!form.reportValidity()) return
    if (register && password.value.length < 12) { status.textContent = 'Use uma senha com pelo menos 12 caracteres.'; return }
    enter.disabled = create.disabled = true
    status.textContent = register ? 'Criando sua conta…' : 'Entrando…'
    try {
      const account = await signIn(email.value.trim(), password.value, register)
      password.value = ''
      form.remove()
      onAuthenticated(account)
    } catch (error) {
      status.textContent = error instanceof Error ? error.message : 'Não foi possível entrar. Tente novamente.'
      enter.disabled = create.disabled = false
    }
  }
  const enter = button(form, 'Entrar', () => { void submit(false) })
  const create = button(form, 'Criar conta', () => { void submit(true) })
  enter.type = create.type = 'button'
  form.addEventListener('submit', event => { event.preventDefault(); void submit(false) })
  parent.append(form)
}
