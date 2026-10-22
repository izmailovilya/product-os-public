// Expired sessions return to login, preserving the current console location.
(() => {
  const original = window.fetch.bind(window)
  window.fetch = async (...args) => {
    const response = await original(...args)
    if (response.status === 401 && new URL(response.url || location.href).origin === location.origin) location.assign('/_share/login?next=' + encodeURIComponent(location.pathname + location.search + location.hash))
    return response
  }
  // A restored browser history entry must recheck an expired or revoked session.
  window.addEventListener('pageshow', event => { if (event.persisted) location.reload() })
})()
