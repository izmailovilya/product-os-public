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
      if (!['open', 'password'].includes(mode)) return json('Режим доступа не настроен.', 503)
      if (mode === 'password' && !configured(env)) return json('Владелец ещё не настроил доступ к консоли.', 503)
      const page = options => loginPage({ ...options, salt: env.SHARE_PASSWORD_HASH?.split('$')[2], iterations: 600000 })
      if (url.pathname === '/_share/login' && method === 'POST') {
        if (mode === 'open') return redirect('/')
        if (request.headers.get('origin') !== url.origin || request.headers.get('sec-fetch-site') === 'cross-site') return json('Откройте форму входа на этом сайте.', 403)
        if (!env.LOGIN_LIMITER) return json('Вход временно недоступен.', 503)
        const limit = await env.LOGIN_LIMITER.limit({ key: 'login:' + (request.headers.get('cf-connecting-ip') || 'local-preview') })
        const wantsJSON = request.headers.get('accept')?.includes('application/json')
        if (!limit.success) return wantsJSON ? json('Слишком много попыток. Попробуйте через минуту.', 429) : response(page({ error: 'Слишком много попыток. Попробуйте через минуту.' }), 429, { 'content-type': 'text/html; charset=utf-8', 'retry-after': '60' })
        let form
        try { form = await boundedForm(request) } catch { return json('Форма входа не принята.', 400) }
        const next = safeNext(form.get('next'))
        if (!await checkProof(form.get('proof') || '', env.SHARE_PASSWORD_HASH)) return wantsJSON ? json('Неверный пароль. Попробуйте ещё раз.', 401) : response(page({ error: 'Неверный пароль. Попробуйте ещё раз.', next }), 401, { 'content-type': 'text/html; charset=utf-8' })
        if (wantsJSON) return response(JSON.stringify({ next }), 200, { 'content-type': 'application/json', 'set-cookie': await issueSession(env, url.origin) })
        return redirect(next, { 'set-cookie': await issueSession(env, url.origin) })
      }
      if (url.pathname === '/_share/logout' && method === 'POST') {
        if (request.headers.get('origin') !== url.origin) return json('Запрос с другого сайта отклонён.', 403)
        return redirect('/_share/login', { 'set-cookie': clearSession() })
      }
      if (!['GET', 'HEAD'].includes(method)) return json('Консоль доступна только для просмотра.', 405)
      if (url.pathname === '/_share/login') return mode === 'open' ? redirect('/') : response(method === 'HEAD' ? null : page({ next: safeNext(url.searchParams.get('next')) }), 200, { 'content-type': 'text/html; charset=utf-8' })
      if (mode === 'password' && !publicFile(url.pathname) && !await hasSession(request, env)) {
        if (url.pathname === '/' || request.headers.get('accept')?.includes('text/html')) return response(method === 'HEAD' ? null : page({ next: safeNext(url.pathname + url.search) }), 401, { 'content-type': 'text/html; charset=utf-8' })
        return json('Введите пароль для просмотра консоли.', 401)
      }
      const route = routes[routeKey(url.href)]
      if (!route) return response(method === 'HEAD' ? null : 'Эта страница или файл не включены в снимок консоли.', 404, { 'content-type': 'text/plain; charset=utf-8' })
      const asset = await env.ASSETS.fetch(new Request(new URL(route.asset, url.origin), { method: 'GET' }))
      if (!asset.ok) return json('Не удалось загрузить сохранённую страницу.', 503)
      return response(method === 'HEAD' ? null : asset.body, route.status, route.headers)
    } catch { return json('Не удалось открыть консоль. Попробуйте ещё раз.', 503) }
  } }
}
