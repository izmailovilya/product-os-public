import { button, notice, escapeHTML as esc } from './ui-components.js'

// The page being read and the workspace supplying research are separate identities.
// Used by the real extension and the fictional design-system example.
export const landingConnectionAction = ({ disabled = false } = {}) => button({ label: 'Сменить продукт', disabled, attributes: { id: 'change-product' } })

export function landingPageContext({ page, title = '', reason = '', product, disabled = false, action = true }) {
  const identity = page ? `<p class="panel-meta" title="${esc(title)}">Страница: ${esc(page).replace(/([/.])/g, '$1<wbr>')}</p>`
    : notice({ message: reason || 'Определяю активную страницу.' })
  return `<section class="panel-context">${identity}<p class="panel-meta">Подключён продукт: <strong>${esc(product)}</strong></p>${action ? landingConnectionAction({ disabled }) : ''}</section>`
}

export function landingAnalysisIntro() {
  return '<p>Найдёт задачи и адресатов по тексту страницы.</p>'
}
