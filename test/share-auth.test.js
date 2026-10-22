const test = require('node:test')
const assert = require('node:assert/strict')
const path = require('node:path')
const { pathToFileURL } = require('node:url')
const moduleURL = name => pathToFileURL(path.resolve(__dirname, '../bin/share/' + name))
const modules = Promise.all([import(moduleURL('auth.mjs')), import(moduleURL('worker.mjs'))])
const origin = 'https://team.example.invalid'
const request = (pathname = '/', options = {}) => new Request(origin + pathname, options)
async function fixture(mode = 'password') {
  const [auth, { createShareWorker }] = await modules
  const password = 'a-fictional-test-password'
  const env = { SHARE_PASSWORD_HASH: await auth.passwordRecord(password), SHARE_SESSION_SECRET: 'a'.repeat(43), LOGIN_LIMITER: { limit: async () => ({ success: true }) }, ASSETS: { fetch: async () => new Response('Private product content') } }
  const routes = { '/': { asset: '/_snapshot/abc', status: 200, headers: { 'content-type': 'text/html' } }, '/api/snapshot': { asset: '/_snapshot/abc', status: 200, headers: { 'content-type': 'application/json' } }, '/report?path=reports%2Fplan.md': { asset: '/_snapshot/def', status: 200, headers: { 'content-type': 'text/html' } } }
  const worker = createShareWorker({ mode, routes, loginPage: ({ error = '' } = {}) => 'Password form. ' + error })
  return { auth, env, worker, password }
}
const login = proof => request('/_share/login', { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams({ proof }) })
test('protected content and direct file paths are inaccessible without a session', async () => {
  const { worker, env } = await fixture()
  for (const route of ['/', '/api/snapshot', '/report?path=reports%2Fplan.md', '/source?path=sources%2Fnotes.md', '/_snapshot/abc']) {
    const result = await worker.fetch(request(route), env)
    assert.equal(result.status, 401)
    assert.ok(!(await result.text()).includes('Private product'))
    assert.match(result.headers.get('cache-control'), /no-store/)
  }
})
test('correct password issues a secure session, wrong password and missing credentials never disclose content', async () => {
  const { worker, env, password, auth } = await fixture()
  const incorrect = await worker.fetch(login('wrong'), env); assert.equal(incorrect.status, 401)
  const good = await worker.fetch(login(await auth.passwordProof(password, env.SHARE_PASSWORD_HASH)), env)
  assert.equal(good.status, 303)
  const cookie = good.headers.get('set-cookie')
  for (const attribute of ['__Host-', 'Secure', 'HttpOnly', 'SameSite=Lax', 'Path=/']) assert.ok(cookie.includes(attribute))
  assert.ok(!cookie.includes(password))
  assert.equal((await worker.fetch(request('/api/snapshot', { headers: { cookie } }), env)).status, 200)
  assert.equal((await worker.fetch(request('/'), { ...env, SHARE_PASSWORD_HASH: '' })).status, 503)
})
test('tampering, expiry, another origin and password rotation invalidate sessions', async () => {
  const { auth, env } = await fixture(), now = Date.now()
  const cookie = await auth.issueSession(env, origin, now)
  assert.equal(await auth.hasSession(request('/', { headers: { cookie } }), env, now), true)
  assert.equal(await auth.hasSession(request('/', { headers: { cookie: cookie.replace(/\.[a-f0-9]{64}/, '.' + 'f'.repeat(64)) } }), env, now), false)
  assert.equal(await auth.hasSession(request('/', { headers: { cookie } }), env, now + 8 * 60 * 60 * 1000), false)
  assert.equal(await auth.hasSession(new Request('https://other.example.invalid/', { headers: { cookie } }), env, now), false)
  assert.equal(await auth.hasSession(request('/', { headers: { cookie } }), { ...env, SHARE_PASSWORD_HASH: await auth.passwordRecord('another-fictional-password') }, now), false)
})
test('CSRF, brute-force attempts and write methods are refused', async () => {
  const { worker, env, password } = await fixture()
  assert.equal((await worker.fetch(new Request(origin + '/_share/login', { method: 'POST', headers: { origin: 'https://other.example.invalid', 'content-type': 'application/x-www-form-urlencoded' }, body: 'password=' + password }), env)).status, 403)
  assert.equal((await worker.fetch(login(password), { ...env, LOGIN_LIMITER: { limit: async () => ({ success: false }) } })).status, 429)
  assert.equal((await worker.fetch(login(password), { ...env, LOGIN_LIMITER: undefined })).status, 503)
  for (const method of ['POST', 'PUT', 'DELETE']) assert.equal((await worker.fetch(request('/api/launch', { method }), env)).status, 405)
})
test('open mode remains read-only and unknown asset paths never bypass the route inventory', async () => {
  const { worker, env } = await fixture('open')
  assert.equal(await (await worker.fetch(request('/api/snapshot'), env)).text(), 'Private product content')
  assert.equal((await worker.fetch(request('/_snapshot/abc'), env)).status, 404)
  assert.equal((await worker.fetch(request('/api/launch', { method: 'POST' }), env)).status, 405)
  const head = await worker.fetch(request('/', { method: 'HEAD' }), env)
  assert.equal(head.status, 200); assert.equal(await head.text(), '')
})
test('oversized login bodies and redirect injection cannot be used', async () => {
  const { worker, env, auth } = await fixture()
  const result = await worker.fetch(new Request(origin + '/_share/login', { method: 'POST', headers: { origin, 'content-type': 'application/x-www-form-urlencoded' }, body: 'password=' + 'a'.repeat(5000) }), env)
  assert.equal(result.status, 400)
  for (const next of ['//evil.example', '/\\evil.example', '/_share/login', '/\nLocation: evil', '/\t/evil.example', '/path/../_share/login']) assert.equal(auth.safeNext(next), '/')
  assert.equal(auth.safeNext('/#segments'), '/#segments')
})
