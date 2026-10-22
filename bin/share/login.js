import { setFieldError } from '/ui-components.js'
const form = document.querySelector('.share-login-form')
form.addEventListener('submit', async event => {
  event.preventDefault()
  const input = form.querySelector('[name=password]'), button = form.querySelector('button[type=submit]')
  if (button.disabled) return
  setFieldError(input, ''); button.disabled = true; button.textContent = 'Проверяю пароль…'
  try {
    // Password stretching runs in the browser, within Workers Free's CPU budget.
    const salt = Uint8Array.from(form.dataset.salt.match(/.{2}/g), value => parseInt(value, 16))
    const key = await crypto.subtle.importKey('raw', new TextEncoder().encode(input.value), 'PBKDF2', false, ['deriveBits'])
    const bits = await crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt, iterations: Number(form.dataset.iterations) }, key, 256)
    const proof = Array.from(new Uint8Array(bits), byte => byte.toString(16).padStart(2, '0')).join('')
    const response = await fetch('/_share/login', { method: 'POST', headers: { accept: 'application/json' }, body: new URLSearchParams({ proof, next: new FormData(form).get('next') }) })
    const result = await response.json()
    if (!response.ok) { setFieldError(input, result.error || 'Не удалось войти. Повторите попытку.'); input.focus(); return }
    location.assign(result.next)
  } catch { setFieldError(input, 'Не удалось войти. Проверьте соединение и повторите попытку.'); input.focus() }
  finally { button.disabled = false; button.textContent = 'Открыть консоль' }
})
