import { boundedForm, checkProof, configured, clearSession, hasSession, issueSession, routeKey, safeNext } from './auth.mjs'

const security = {
  'cache-control': 'private, no-store',
  'x-content-type-options': 'nosniff',
  'referrer-policy': 'same-origin',
  'x-frame-options': 'DENY',
  'content-security-policy': "default-src 'self'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self'; connect-src 'self'; frame-ancestors 'none'; object-src 'none'; base-uri 'none'; form-action 'self'",
}
function response(body, status = 200, headers = {}) { return new Response(body, { status, headers: { ...security, ...headers } }) }
function json(error, status) { return response(JSON.stringify({ error }), status, { 'content-type': 'application/json; charset=utf-8' }) }
function redirect(location, headers = {}) { return response(null, 303, { location, ...headers }) }
const publicFile = pathname => ['/design-system.css', '/ui-components.css', '/ui-components.js', '/ui-tokens.css', '/fonts.css', '/_share/login.css', '/_share/login.js', '/assets/brand/mark-ink.svg'].includes(pathname) || /^\/assets\/fonts\/[a-z0-9_/-]+\.woff2$/i.test(pathname)

export function createShareWorker({ mode, routes, loginPage }) {
  return { async fetch(request, env) {
    const url = new URL(request.url), method = request.method
    try {
      if (url.protocol !== 'https:' && !['localhost', '127.0.0.1', '[::1]'].includes(url.hostname)) { url.protocol = 'https:'; return response(null, 308, { location: url.href }) }
      if (!['open', 'password'].includes(mode)) return json("The access mode is not configured.", 503)
      if (mode === 'password' && !configured(env)) return json("The owner has not yet configured access to the console.", 503)
      const page = options => loginPage({ ...options, salt: env.SHARE_PASSWORD_HASH?.split('$')[2], iterations: 600000 })
      if (url.pathname === '/_share/login' && method === 'POST') {
        if (mode === 'open') return redirect('/')
        if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return json("Open the login form on this site.", 403)
        if (!env.LOGIN_LIMITER) return json("Login is temporarily unavailable.", 503)
        const limit = await env.LOGIN_LIMITER.limit({ key: 'login:' + (request.headers.get('cf-connecting-ip') || 'local-preview') })
        const wantsJSON = request.headers.get('accept')?.includes('application/json')
        if (!limit.success) return wantsJSON ? json("Too many attempts. Try again in a minute.", 429) : response(page({ error: "Too many attempts. Try again in a minute." }), 429, { 'content-type': 'text/html; charset=utf-8', 'retry-after': '60' })
        let form
        try { form = await boundedForm(request) } catch { return json("The login form was not accepted.", 400) }
        const next = safeNext(form.get('next'))
        if (!await checkProof(form.get('proof') || '', env.SHARE_PASSWORD_HASH)) return wantsJSON ? json("Invalid password. Try again.", 401) : response(page({ error: "Invalid password. Try again.", next }), 401, { 'content-type': 'text/html; charset=utf-8' })
        if (wantsJSON) return response(JSON.stringify({ next }), 200, { 'content-type': 'application/json', 'set-cookie': await issueSession(env, url.origin) })
        return redirect(next, { 'set-cookie': await issueSession(env, url.origin) })
      }
      if (url.pathname === '/_share/logout' && method === 'POST') {
        if (request.headers.get('origin') !== url.origin) return json("The request from another site was rejected.", 403)
        return redirect('/_share/login', { 'set-cookie': clearSession() })
      }
      if (!['GET', 'HEAD'].includes(method)) return json("The console is view-only.", 405)
      if (url.pathname === '/_share/login') return mode === 'open' ? redirect('/') : response(method === 'HEAD' ? null : page({ next: safeNext(url.searchParams.get('next')) }), 200, { 'content-type': 'text/html; charset=utf-8' })
      if (mode === 'password' && !publicFile(url.pathname) && !await hasSession(request, env)) {
        if (url.pathname === '/' || request.headers.get('accept')?.includes('text/html')) return response(method === 'HEAD' ? null : page({ next: safeNext(url.pathname + url.search) }), 401, { 'content-type': 'text/html; charset=utf-8' })
        return json("Enter the password to view the console.", 401)
      }
      const route = routes[routeKey(url.href)]
      if (!route) return response(method === 'HEAD' ? null : "This page or file is not included in the console snapshot.", 404, { 'content-type': 'text/plain; charset=utf-8' })
      const asset = await env.ASSETS.fetch(new Request(new URL(route.asset, url.origin), { method: 'GET' }))
      if (!asset.ok) return json("The saved page could not be loaded.", 503)
      return response(method === 'HEAD' ? null : asset.body, route.status, route.headers)
    } catch { return json("The console could not be opened. Try again.", 503) }
  } }
}
