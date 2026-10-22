// Web Crypto only: runs unchanged in Cloudflare Workers and Node's local preview.
const encoder = new TextEncoder()
const COOKIE = '__Host-product_os_share'
const TTL = 8 * 60 * 60
const hex = value => Array.from(new Uint8Array(value), byte => byte.toString(16).padStart(2, '0')).join('')
const bytes = value => Uint8Array.from(value.match(/.{2}/g) || [], item => parseInt(item, 16))
const encode = value => btoa(String.fromCharCode(...encoder.encode(value))).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '')
const decode = value => new TextDecoder().decode(Uint8Array.from(atob(value.replace(/-/g, '+').replace(/_/g, '/')), c => c.charCodeAt(0)))
const sha = async value => hex(await crypto.subtle.digest('SHA-256', encoder.encode(value)))

export async function passwordRecord(password) {
  if (typeof password !== 'string' || password.length < 12 || encoder.encode(password).length > 512) throw new Error('Пароль должен содержать от 12 символов и не более 512 байт.')
  const salt = hex(crypto.getRandomValues(new Uint8Array(16)))
  const proof = hex(await derive(password, salt, 600000))
  return `pbkdf2-sha256$600000$${salt}$${await sha(proof)}`
}
async function derive(password, salt, iterations) {
  const key = await crypto.subtle.importKey('raw', encoder.encode(password), 'PBKDF2', false, ['deriveBits'])
  return crypto.subtle.deriveBits({ name: 'PBKDF2', hash: 'SHA-256', salt: bytes(salt), iterations }, key, 256)
}
export function configured(env) {
  return typeof env.SHARE_SESSION_SECRET === 'string' && env.SHARE_SESSION_SECRET.length >= 43 && /^pbkdf2-sha256\$600000\$[a-f0-9]{32}\$[a-f0-9]{64}$/.test(env.SHARE_PASSWORD_HASH || '')
}
export async function passwordProof(password, record) {
  if (typeof password !== 'string' || encoder.encode(password).length > 512) return false
  const [, iterations, salt] = record.split('$')
  return hex(await derive(password, salt, Number(iterations)))
}
export async function checkProof(proof, record) {
  if (!/^[a-f0-9]{64}$/.test(proof || '')) return false
  const expected = record.split('$')[3]
  const actual = bytes(await sha(proof)), wanted = bytes(expected)
  let difference = actual.length ^ wanted.length
  for (let i = 0; i < actual.length; i++) difference |= actual[i] ^ wanted[i]
  return difference === 0
}
async function key(env) {
  return crypto.subtle.importKey('raw', encoder.encode(env.SHARE_SESSION_SECRET), { name: 'HMAC', hash: 'SHA-256' }, false, ['sign', 'verify'])
}
export async function issueSession(env, origin, now = Date.now()) {
  const payload = encode(JSON.stringify({ v: 1, exp: Math.floor(now / 1000) + TTL, aud: origin, revision: await sha(env.SHARE_PASSWORD_HASH) }))
  const signature = hex(await crypto.subtle.sign('HMAC', await key(env), encoder.encode(payload)))
  return `${COOKIE}=${payload}.${signature}; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=${TTL}`
}
export async function hasSession(request, env, now = Date.now()) {
  try {
    const cookie = (request.headers.get('cookie') || '').split(';').map(value => value.trim()).find(value => value.startsWith(COOKIE + '='))?.slice(COOKIE.length + 1)
    if (!cookie || cookie.length > 2048) return false
    const [payload, signature, extra] = cookie.split('.')
    if (extra || !/^[a-f0-9]{64}$/.test(signature || '')) return false
    if (!await crypto.subtle.verify('HMAC', await key(env), bytes(signature), encoder.encode(payload))) return false
    const value = JSON.parse(decode(payload)), seconds = Math.floor(now / 1000)
    return value.v === 1 && Number.isInteger(value.exp) && value.exp > seconds && value.exp <= seconds + TTL && value.aud === new URL(request.url).origin && value.revision === await sha(env.SHARE_PASSWORD_HASH)
  } catch { return false }
}
export function clearSession() { return `${COOKIE}=; Path=/; Secure; HttpOnly; SameSite=Lax; Max-Age=0` }
export function routeKey(value) {
  const url = new URL(value, 'https://snapshot.invalid')
  url.searchParams.sort()
  return url.pathname + (url.searchParams.size ? '?' + url.searchParams.toString() : '')
}
export function safeNext(value) {
  if (typeof value !== 'string' || !value.startsWith('/') || value.startsWith('//') || /[\\\u0000-\u0020\u007f]/.test(value)) return '/'
  const url = new URL(value, 'https://snapshot.invalid')
  return url.origin === 'https://snapshot.invalid' && !url.pathname.startsWith('/_share') ? url.pathname + url.search + url.hash : '/'
}
export async function boundedForm(request) {
  if (!/^application\/x-www-form-urlencoded(?:;|$)/i.test(request.headers.get('content-type') || '')) throw new Error('Нужна форма входа.')
  const reader = request.body?.getReader()
  if (!reader) return new URLSearchParams()
  let result = '', size = 0
  const decoder = new TextDecoder()
  try {
    while (true) {
      const { done, value } = await reader.read()
      if (done) break
      size += value.byteLength
      if (size > 4096) throw new Error('Слишком большая форма.')
      result += decoder.decode(value, { stream: true })
    }
    return new URLSearchParams(result + decoder.decode())
  } finally { await reader.cancel() }
}
