// Research actions describe a missing answer, not a request to rerun the whole map.
const COMPETITOR_GAPS = [
  { id: 'identity', label: 'Уточнить конкретное решение', reason: 'В карточке описан класс решений. Нужны конкретные продукты и отдельные источники по каждому.', action: 'Найти решения в этой категории', output: 'Отдельные карточки проверенных продуктов внутри категории; общие данные категории останутся отдельно' },
  { id: 'jobs', label: 'Проверить задачи конкурента', reason: 'Пересечение клиентских задач ещё не показывает, какую часть задачи конкурент действительно закрывает.', action: 'Проверить, какие задачи он решает', output: 'По каждой общей задаче: что поддерживается, ограничения, сегмент и подтверждающие источники' },
  { id: 'pricing', label: 'Проверить стоимость', reason: 'Нет проверенного описания тарифов и дополнительных затрат конкретного решения.', action: 'Проверить тарифы и затраты', output: 'Тариф, валюта, период, единица расчёта, условия и ссылка на источник; внедрение отдельно от подписки' },
  { id: 'messaging', label: 'Разобрать коммуникацию', reason: 'Нет датированного снимка сайта конкурента с его обещаниями клиентам.', action: 'Снять сайт и разобрать обещания', output: 'Датированный снимок сайта (текст и скриншот в sources/competitors/), первый экран, обещания по работам сегментов с дословными цитатами и ссылкой на снимок' },
  { id: 'complaints', label: 'Исследовать жалобы', reason: 'Отзывы и ограничения решения ещё не исследованы.', action: 'Исследовать отзывы и жалобы', output: 'Конкретные ограничения и жалобы с источниками, датами и контекстом клиента; отдельно — область, где ничего не найдено' },
  { id: 'channels', label: 'Исследовать продвижение', reason: 'Не установлено, где конкурент привлекает клиентов.', action: 'Изучить каналы продвижения', output: 'Наблюдаемые каналы, примеры сообщений и ссылки; предположения об эффективности отмечены отдельно' },
]

function dossierGaps(node, dossier = {}) {
  if (node.type === 'product') return [{
    id: 'positioning', action: dossier.positioning?.touchpoints?.length ? 'Обновить позиционирование продукта' : 'Разобрать позиционирование продукта',
    reason: 'Нужно сопоставить реальные обещания на сайте и в соцсетях с задачами и сегментами клиентов.',
    output: 'Текущие сообщения по каждой площадке со ссылками и задачами клиентов; предложения по изменению отдельно от наблюдаемых фактов',
  }]
  if (node.type === 'competitor' && (dossier.isCategory || node.data?.entityType === 'category')) {
    const identity = node.data?.researchSections?.identity
    return ['researched', 'not_found', 'unavailable'].includes(identity?.status) ? [] : [COMPETITOR_GAPS[0]]
  }
  const explicit = dossier.researchGaps || node.data?.researchGaps
  if (Array.isArray(explicit) && explicit.length) return explicit.filter(gap => !['not_found', 'unavailable'].includes(gap.status)).map(gap => {
    const defaults = COMPETITOR_GAPS.find(item => item.id === gap.id || item.id === gap.section) || {}
    return { ...defaults, ...gap, action: gap.action || gap.label || defaults.action }
  })
  if (node.type === 'competitor') {
    if (dossier.isCategory || node.data?.entityType === 'category') return [COMPETITOR_GAPS[0]]
    const sections = node.data?.researchSections || {}
    const has = {
      jobs: dossier.jobCoverage?.some(row => row.coverage && !['unknown', 'unverified'].includes(row.coverage)),
      pricing: dossier.priceDetails?.some(row => row.evidenceStatus === 'supported'),
      // Only a dated site snapshot closes this gap; older quote lists without a snapshot do not.
      messaging: ['captured', 'text-only', 'legacy'].includes(dossier.landing?.status),
      complaints: dossier.failures?.length > 0,
      channels: dossier.channels?.length > 0,
    }
    return COMPETITOR_GAPS.slice(1).filter(gap => !has[gap.id] && !['completed', 'not_found', 'unavailable'].includes(sections[gap.id]?.status))
  }
  if (node.type !== 'segment') return []
  const completed = node.data?.research?.['product-deep-research']?.outcome === 'completed'
  if (!completed && !node.data?.researchAudit && !dossier.jobs?.length) return [{
    id: 'initial', kind: 'segmentDefinition', action: 'Уточнить задачу и границы сегмента', reason: 'Сегмент пока только назван: не описаны задачи, критерии выбора и существующие решения.', output: 'Определение этого сегмента: ситуация клиента, задача, критерии успеха и отличия от соседних сегментов; остальные сегменты сохраняются',
  }]
  const gaps = []
  const jobs = dossier.jobs || []
  if (!jobs.length || jobs.some(job => !job.criteria?.length)) gaps.push({
    id: 'criteria', action: 'Уточнить критерии успеха', reason: 'Не для всех задач описано, какой результат клиент считает успешным.', output: 'Задача и измеримые критерии успеха без дублирования формулировок; источники или явно отмеченные гипотезы',
  })
  if ((dossier.problems || []).some(problem => !problem.evidenceCount) || !dossier.sources?.length) gaps.push({
    id: 'evidence', action: 'Проверить основания выводов о сегменте', reason: 'В досье есть выводы без связанных свидетельств. Нужно проверить именно эти утверждения и связать их с источниками.', output: 'Подтверждения и возражения к конкретным болям и критериям, с цитатами и ссылками; список оставшихся неизвестных',
  })
  return gaps
}

const ISSUE_LABELS = {
  'missing-failure-test': 'Не описан способ измерить результат проверки.',
  'invalid-failure-test': 'Нужно уточнить метрику, порог и способ измерения результата.',
  'missing-assumption': 'Не указано, какое допущение проверяет задача.',
  'unknown-assumption': 'Указанное допущение не найдено в карте.',
  'unknown-or-ambiguous-assumption': 'Указанное допущение не найдено в карте или указано неоднозначно.',
  'missing-outcome': 'Не описан ожидаемый результат задачи.',
  'canonical-now-capacity-exceeded': 'На ближайшее время уже назначены три задачи. Нужно выбрать, что перенести.',
  'research-plan-incomplete': 'Исследование завершилось частично; план требует проверки по оставшимся пробелам.',
}
const RESOURCE_FIELDS = { budgetUsd: 'Бюджет', hours: 'Время', people: 'Число участников' }

function explainMoveIssues(item) {
  const issues = (item.issues || []).map(issue => typeof issue === 'string' ? issue : issue.message || issue.reason || issue.code).filter(Boolean)
  const labels = issues.map(issue => ISSUE_LABELS[issue] || (
    issue.startsWith('constraint-exceeded-or-unknown:') ? `${RESOURCE_FIELDS[issue.split(':')[1]] || 'Ресурс'} задачи превышает ограничение или неизвестен.` :
    issue.startsWith('now-move-has-pending-dependencies:') ? 'У задачи на ближайшее время есть незавершённые зависимости — дождитесь их или измените порядок.' :
    /assumption|test-target/.test(issue) ? 'Требует уточнения проверяемое допущение и его связь с задачей.' :
    /failure|threshold|metric|measurement|sample|deadline/.test(issue) ? 'Требуют уточнения метрика, порог, способ измерения и срок проверки.' :
    /depend/.test(issue) ? 'Требуют уточнения зависимости: какая задача должна быть завершена раньше.' :
    /resource|budget|capacity/.test(issue) ? 'Требует проверки, укладываются ли ресурсы задачи в ограничения.' :
    /outcome|output/.test(issue) ? 'Требует уточнения ожидаемый результат задачи.' :
    /[а-яё]/i.test(issue) ? issue : 'Нужно проверить полноту плана и его связь с целью продукта.'
  ))
  if (!labels.length && item.executionReady === false) labels.push(item.testsAssumptionId
    ? 'В плане проверки не хватает измеримого результата или условий проведения.'
    : 'Для задачи ещё не согласованы результат, ответственный или условия выполнения.')
  return [...new Set(labels)]
}

module.exports = { dossierGaps, explainMoveIssues }
