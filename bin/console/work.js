// Owner-entered progress is kept separately from research evidence and graph truth.
const { hash } = require('./model')
const STATUSES = new Set(['planned', 'checking', 'confirmed', 'refuted', 'partial'])
function updateWork(store, snapshot, body) {
  if (!STATUSES.has(body.status)) throw Object.assign(new Error('Выберите статус проверки.'), { status: 400 })
  const node = [...snapshot.graph.nodes,...(snapshot.galaxy?.values||[])].find(node => node.id === body.nodeId)
  const report = snapshot.reports.find(report => report.path === body.reportPath)
  if (!node && !report) throw Object.assign(new Error('Объект или отчёт больше не найден. Обновите страницу.'), { status: 404 })
  const id = report ? `report:${hash(report.path)}` : node.id
  const note = typeof body.note === 'string' ? body.note.trim() : ''
  if (note.length > 10000 || (['confirmed','refuted','partial'].includes(body.status) && !note)) throw Object.assign(new Error('Запишите, что узнали по результатам проверки (до 10 000 символов).'), { status: 400 })
  const dueDate = body.dueDate || ''
  if (dueDate && (!/^\d{4}-\d{2}-\d{2}$/.test(dueDate) || Number.isNaN(Date.parse(dueDate)))) throw Object.assign(new Error('Укажите дату в формате ГГГГ-ММ-ДД.'), { status: 400 })
  let saved
  store.update(state => {
    state.humanWork ||= {}
    const previous = state.humanWork[id]
    if ((previous?.revision || 0) !== body.expectedRevision) throw Object.assign(new Error('Запись изменилась в другом окне. Откройте её заново; ваш текст сохранён в черновике.'), { status: 409 })
    const now = new Date().toISOString()
    saved = { id, nodeId: node?.id || null, reportPath: report?.path || null,
      title: report ? report.nextStep || `Разобрать следующий ход: ${report.title}` : node.label,
      status: body.status, note, dueDate, startedAt: previous?.startedAt || now, updatedAt: now,
      revision: (previous?.revision || 0) + 1,
      history: [...(previous?.history || []), ...(previous ? [{ status: previous.status, note: previous.note, dueDate: previous.dueDate, updatedAt: previous.updatedAt }] : [])],
    }
    state.humanWork[id] = saved
  })
  return saved
}
module.exports = { updateWork }
