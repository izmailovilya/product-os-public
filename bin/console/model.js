const fs = require('fs')
const { parseMoves } = require('../moves')
const { digest } = require('../graph/schema')
const { verificationOf } = require('../verification')
const path = require('path')
const crypto = require('crypto')
const { buildGalaxyProjection } = require('./galaxy-model')
const { dossierGaps, explainMoveIssues } = require('./research-actions')
const { isPublicEdition, PUBLIC_SKILLS } = require('../edition')

const STATUS_LABELS = {
  hypothesis: 'гипотеза',
  evidenced: 'есть свидетельства',
  validated: 'подтверждён',
  contradicted: 'опровергнут',
  dropped: 'отброшен',
}

const TYPE_LABELS = {
  product: 'продукт', segment: 'сегмент', competitor: 'конкурент', assumption: 'риск',
  evidence: 'знание', artifact: 'знание', criterion: 'критерий', job: 'задача клиента',
  problem: 'проблема', channel: 'канал', move: 'ход', role: 'роль в покупке',
  value: 'гипотеза ценности',
}

const SKILL_GROUPS = [{id:'management',title:'Продукт'},{id:'research',title:'Исследования'},{id:'library',title:'Библиотека'}]
const SKILL_META = {
  "os-setup": {
    "category": "management",
    "order": -3,
    "targetTypes": [
      "product"
    ],
    "title": "Настроить рабочее место",
    "description": "Создать или восстановить структуру и паспорт продукта.",
    "output": "Рабочее место и паспорт продукта"
  },
  "product-context": {
    "category": "management",
    "order": -2,
    "targetTypes": [
      "product",
      "segment",
      "competitor",
      "artifact"
    ],
    "title": "Добавить контекст",
    "duration": "По объёму материалов",
    "minutes": 8,
    "description": "Сохранить новые материалы, факты и уточнения с точными источниками.",
    "output": "Сохранённые оригиналы и проверяемые изменения продуктовой памяти"
  },
  "product-status": {
    "category": "management",
    "order": -1,
    "targetTypes": [
      "product"
    ],
    "title": "Где мы и что дальше",
    "duration": "5–10 мин",
    "minutes": 8,
    "description": "Прочитать накопленный контекст и предложить следующий обоснованный шаг.",
    "output": "Короткий разбор состояния и один обоснованный следующий ход"
  },
  "product-research": {},
  "product-segment-hypotheses": {
    "category": "research",
    "title": "Гипотезы сегментов",
    "duration": "2–5 мин",
    "minutes": 4,
    "output": "8–15 сегментов по задачам клиентов, вопросы квалификации и риски"
  },
  "product-job-map": {
    "category": "research",
    "targetTypes": [
      "product"
    ],
    "title": "Карта работ",
    "duration": "Зависит от объёма",
    "description": "Связать задачи клиентов и увидеть, где продукт помогает, где нужны доработки и что стоит исследовать.",
    "output": "Стратегическая карта верхних и нижних работ, границы продукта и предварительные связи с сегментами"
  },
  "product-brand-identity": {
    "category": "library",
    "order": 11,
    "targetTypes": [
      "product"
    ],
    "title": "Айдентика бренда",
    "description": "Создать или развить фирменный стиль продукта: от брифа и визуальных направлений до правил и файлов для команды.",
    "duration": "По объёму айдентики",
    "minutes": 30,
    "output": "Визуальные направления, система бренда, логобук и исходники с проверенными примерами применения"
  },
  "product-reference-library": {
    "category": "library",
    "targetTypes": [
      "product"
    ],
    "title": "Собрать библиотеку продуктовых референсов",
    "description": "Конкретные примеры конкурентов с изображениями и источниками; проверка, свои примеры и удобный доступ из консоли.",
    "duration": "По выбранному объёму",
    "minutes": 45,
    "output": "Библиотека по направлениям, проверка источников и материалы для проектирования"
  }
}

const MOVE_CATALOG = {
  hq: { ...SKILL_META['product-status'], title: 'Где мы и что дальше?', skill: 'product-status' },
  deepResearch: { ...SKILL_META['product-deep-research'], title: 'Глубокое исследование', skill: 'product-deep-research' },
  walkthrough: { ...SKILL_META['product-walkthrough'], title: 'Пройти флоу как сегмент', skill: 'product-walkthrough' },
  testRisk: { ...SKILL_META['product-risk-analysis'], title: 'Подготовить проверку риска', skill: 'product-risk-analysis' },
  compare: {
    title: 'Сравнить по задачам клиентов', skill: 'product-deep-research', duration: '10–20 мин', minutes: 15,
    output: 'Сравнение по задачам клиентов и открытые слабые места конкурента',
  },
  researchGap: {
    title: 'Уточнить данные исследования', skill: 'product-deep-research', duration: '5–15 мин', minutes: 10,
    output: 'Ответ на конкретный вопрос, источники и обновлённый раздел досье',
  },
  segmentDefinition: {
    ...SKILL_META['product-segment-hypotheses'], title: 'Уточнить задачу и границы сегмента', skill: 'product-segment-hypotheses',
    output: 'Определение этого сегмента: ситуация, задача, критерии успеха и отличия от соседних сегментов',
  },
  fieldValue: {
    title: 'Подготовить проверку ценности', skill: 'product-risk-analysis', duration: '5–10 мин', minutes: 8,
    output: 'План полевой проверки ценности с критерием успеха',
  },
  reconsider: {
    title: 'Пересмотреть вердикт', skill: 'product-context', duration: '5–10 мин', minutes: 8,
    output: 'Новые свидетельства за и против + обновлённый вердикт на карте',
  },
  ingest: {
    title: 'Добавить выводы отчёта в карту', skill: 'product-context', duration: '2–5 мин', minutes: 4,
    output: 'Факты из отчёта попадут в карту с источниками и статусами',
  },
  custom: {
    title: 'Выполнить ход', skill: 'custom', duration: '5–10 мин', minutes: 8,
    output: 'Результат хода и обновлённые знания продукта',
  },
}

function hash(value) {
  return crypto.createHash('sha1').update(String(value)).digest('hex').slice(0, 12)
}

function safeRead(file) {
  try { return fs.readFileSync(file, 'utf8') } catch { return null }
}

function firstHeading(text, fallback) {
  return text?.match(/^#\s+(.+)$/m)?.[1]?.trim() || fallback
}

function humanDate(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return new Intl.DateTimeFormat('ru-RU', { day: 'numeric', month: 'short' }).format(date).replace('.', '')
}

function timeLabel(value) {
  const date = new Date(value)
  if (Number.isNaN(date.getTime())) return ''
  return date.toLocaleTimeString('ru-RU', { hour: '2-digit', minute: '2-digit' })
}

function walkFiles(root, predicate) {
  const out = []
  if (!fs.existsSync(root)) return out
  const walk = current => {
    for (const entry of fs.readdirSync(current, { withFileTypes: true })) {
      const absolute = path.join(current, entry.name)
      if (entry.isDirectory()) walk(absolute)
      else if (predicate(absolute)) out.push(absolute)
    }
  }
  walk(root)
  return out
}

function parseFrontmatter(text) {
  if (!text?.startsWith('---\n')) return {}
  const end = text.indexOf('\n---', 4)
  if (end < 0) return {}
  const out = {}
  let active = null
  for (const line of text.slice(4, end).split('\n')) {
    const field = line.match(/^([\w-]+):\s*(.*)$/)
    if (field) {
      active = field[1]
      out[active] = field[2].replace(/^>-?\s*/, '').trim()
    } else if (active && /^\s+/.test(line)) out[active] += ` ${line.trim()}`
  }
  return out
}

// Reports share a directory across orientation, ingestion and feature notes. Only
// explicit product-state reports (or legacy orientation titles) may head the product.
function reportText(markdown) {
  return String(markdown || '')
    .replace(/<!--[\s\S]*?-->/g, '')
    .replace(/<(script|style)\b[^>]*>[\s\S]*?<\/\1>/gi, '')
    .replace(/<\/?[a-z][^>]*>/gi, '')
    .replace(/!?\[([^\]]+)\]\([^)]+\)/g, '$1')
    .replace(/[*_`]/g, '').replace(/^[>]+\s?/gm, '')
    .replace(/&nbsp;/gi, ' ').replace(/&amp;/gi, '&')
    .replace(/&quot;/gi, '"').replace(/&#39;/g, "'")
    .replace(/\s+/g, ' ').trim()
}

function reportParagraphs(markdown) {
  return markdown.replace(/^---[\s\S]*?\n---\s*/, '').split(/\n\s*\n/)
    .map(part => part.trim())
    .filter(part => part && !/^#{1,6}\s|^[-*]\s|^\d+[.)]\s|^\|/.test(part))
    .map(reportText).filter(Boolean)
}

function reportSummary(markdown) {
  const text=reportParagraphs(markdown).slice(0, 2).join(' ')
  return text.length>700?text.slice(0,700).replace(/\s+\S*$/,'')+'…':text
}

function reportNextStep(markdown) {
  const lines = markdown.replace(/^---[\s\S]*?\n---\s*/, '').split('\n')
  const label = /^(?:Один следующий ход|Следующий ход|Следующий шаг|The next move|Next step)[.:]?$/i
  const heading = line => {
    const match = line.match(/^#{1,6}\s+(?:\d+[.)]\s*)?(.+?)\s*#*$/)
    if (match) return { title: reportText(match[1]), rest: '' }
    const bold = line.match(/^(?:\d+[.)]\s*)?\*\*([^*\n]{1,80})\*\*\s*(.*)$/)
    return bold ? { title: bold[1].trim(), rest: bold[2] } : null
  }
  const start = lines.findIndex(line => { const h = heading(line); return h && label.test(h.title) })
  if (start < 0) return null
  const content = [heading(lines[start]).rest]
  for (const line of lines.slice(start + 1)) {
    if (heading(line)) break
    content.push(line)
  }
  return content.join('\n').split(/\n\s*\n/).map(reportText).filter(Boolean).join('\n\n') || null
}

function isProductStateReport(fm, title, slug, nodes) {
  if (fm.nodeId && !nodes.some(node => node.type === 'product' && node.id === fm.nodeId)) return false
  if (fm.reportType) return fm.reportType === 'product-state'
  return slug === 'product-hq' && /где мы|где находимся|состояние продукта|where we (?:are|stand)|product status/i.test(title)
}

function humanSkillName(slug) {
  return SKILL_META[slug]?.title || ({'product-hq':'Состояние продукта (архив)','custom':'Порученная задача','ui-design':'Дизайн интерфейса','runtime-fixes':'Исправления работы системы','analyze-interviews':'Разбор интервью','product-ui-design':'Дизайн интерфейса','product-search-audit':'Аудит поиска'})[slug] || 'Исследование'
}

function loadReports(workspace, nodes) {
  const root = path.join(workspace, 'reports')
  return walkFiles(root, file => file.endsWith('.md')).map(file => {
    const text = safeRead(file) || ''
    const fm = parseFrontmatter(text)
    const relative = path.relative(workspace, file).split(path.sep).join('/')
    // Keep working prompts and review exchanges at their original URLs, outside
    // the reader's research report list. They are provenance, not deliverables.
    if (['internal','archive'].includes(fm.visibility) || /(?:^|\/)(?:critic|generator)\//.test(relative) || /^reports\/segmentation\/.*\/state\.md$/i.test(relative) || /\/(?:prompt|full-preparation-context|review-responses|(?:.+-)?request(?:-v\d+)?)\.md$/i.test(relative)) return null
    const stat = fs.statSync(file)
    // filename dates are day-precision ("2026-09-02" = midnight); a launch at 10:39 must still
    // claim a report written at 10:49 the same day — so keep the file's own timestamp too
    const stamp = path.basename(file).match(/(\d{4}-\d{2}-\d{2})(?:_(\d{2})-(\d{2}))?/)
    const filenameDate = stamp ? stamp[2] ? `${stamp[1]}T${stamp[2]}:${stamp[3]}` : stamp[1] : null
    const dateText = fm.date && !(stamp?.[2] && fm.date === stamp[1]) ? fm.date : filenameDate
    const date = dateText ? new Date(dateText).getTime() : stat.mtimeMs
    const written = Math.max(date, stat.mtimeMs)
    const rawSlug = fm.skill || relative.split('/')[1] || 'исследование'
    const slug = ({ 'deep-research': 'product-deep-research', walkthrough: 'product-walkthrough', hq: 'product-hq', 'risk-analysis': 'product-risk-analysis', 'segment-hypotheses': 'product-segment-hypotheses' })[rawSlug] || rawSlug
    const title = fm.title || firstHeading(text, path.basename(file, '.md'))
    const productState = isProductStateReport(fm, title, slug, nodes)
    const summary = fm.summary ? reportText(fm.summary) : reportSummary(text)
    const mentions = nodes.filter(node => node.label && summary.toLocaleLowerCase('ru').includes(node.label.toLocaleLowerCase('ru')))
      .map(node => ({ id: node.id, label: node.label })).slice(0, 8)
    return {
      path: relative, title, outcome:['partial','completed','failed'].includes(fm.outcome)?fm.outcome:null, productState, stateSummary: productState ? (fm.summary ? reportText(fm.summary) : reportParagraphs(text)[0] || '') : null,
      date, written, dateLabel: humanDate(date), method: humanSkillName(slug), skill: slug,
      skillSlug: slug, runId: fm.runId || null, nodeId: fm.nodeId || null, summary, mentions,
      nextStep: reportNextStep(text),
      integrated: nodes.some(node => !['artifact', 'move'].includes(node.type) && (node.source === relative || Object.values(node.data?.research || {}).some(run => run.report === relative && run.outcome === 'completed'))),
    }
  }).filter(Boolean).sort((a, b) => b.date - a.date || b.written - a.written)
}

function loadSkills(repoRoot) {
  const skillsRoot = path.join(repoRoot, 'skills')
  if (!fs.existsSync(skillsRoot)) return []
  // Setup and toolkit UI maintenance remain available in the CLI, outside product tasks.
  return fs.readdirSync(skillsRoot, { withFileTypes: true }).filter(entry => entry.isDirectory() && (entry.name !== 'os-setup' || isPublicEdition(repoRoot)) && SKILL_META[entry.name]?.category !== 'console' && fs.existsSync(path.join(skillsRoot, entry.name, 'SKILL.md'))).map(entry => {
    const slug = entry.name
    const text = safeRead(path.join(skillsRoot, slug, 'SKILL.md')) || ''
    const fm = parseFrontmatter(text)
    const meta = SKILL_META[slug] || {}
    const breath = text.match(/> \*\*In one breath:\*\*\s*([^\n]+)/i)?.[1]
    const description = (meta.description || breath || fm.description || '').replace(/\s+/g, ' ').trim()
    return {
      slug, title: meta.title || humanSkillName(slug), description,
      category: meta.category || 'other', order: meta.order || 0,
      targetTypes: meta.targetTypes || null,
      duration: meta.duration || '5–10 мин', minutes: meta.minutes || 8,
      output: meta.output || 'Результат работы и обновлённый контекст продукта',
    }
  }).sort((a, b) => SKILL_GROUPS.findIndex(group => group.id === a.category) - SKILL_GROUPS.findIndex(group => group.id === b.category)
    || a.order - b.order || a.title.localeCompare(b.title, 'ru'))
}

function loadArena(repoRoot) {
  const evalRoot = path.join(repoRoot, 'evals')
  const tasks = []
  if (!fs.existsSync(evalRoot)) return { tasks }
  for (const entry of fs.readdirSync(evalRoot, { withFileTypes: true }).filter(x => x.isDirectory())) {
    const taskRoot = path.join(evalRoot, entry.name)
    const resultRoot = path.join(taskRoot, 'results')
    const results = fs.existsSync(resultRoot)
      ? fs.readdirSync(resultRoot).filter(name => name.endsWith('.json')).map(name => {
        try { return JSON.parse(fs.readFileSync(path.join(resultRoot, name), 'utf8')) } catch { return null }
      }).filter(result => result?.solution?.name)
      : []
    const eligible = result => result.checks?.length > 0 && result.checks.every(check => check.passed) && !(result.traps?.missed?.length > 0)
    const passed = results.filter(eligible)
      .sort((a, b) => (Number(b.winRate) || 0) - (Number(a.winRate) || 0)
        || ((b.traps?.caught?.length || 0) - (a.traps?.caught?.length || 0))
        || String(a.solution?.name).localeCompare(String(b.solution?.name), 'ru'))
    const cut = results.filter(result => !eligible(result))
    const calibrationFile = path.join(taskRoot, 'calibration.jsonl')
    const calibrated = new Set((safeRead(calibrationFile) || '').split('\n').filter(Boolean).map(line => {
      try { return JSON.parse(line).pairId } catch { return null }
    }).filter(Boolean))
    const pairs = []
    const seenPairs = new Set()
    for (const pair of results.flatMap(result => result.pairwise || [])) {
      if (!pair.pairId || !pair.fragments || calibrated.has(pair.pairId) || seenPairs.has(pair.pairId)) continue
      seenPairs.add(pair.pairId)
      pairs.push(pair)
    }
    tasks.push({
      id: entry.name,
      title: firstHeading(safeRead(path.join(taskRoot, 'TASK.md')), entry.name).replace(/^Задача:\s*/i, ''),
      leaderboard: passed, cut, calibration: pairs,
    })
  }
  return { tasks }
}

function valueNodes(nodes, edges) {
  const byKey = new Map()
  const virtual = []
  const virtualEdges = []
  const keyFor = title => title.toLocaleLowerCase('ru').replace(/[^a-zа-яё0-9]+/gi, '-')
  for (const product of nodes.filter(node => node.type === 'product')) {
    for (const idea of [...(product.data?.developmentHypotheses || []), ...(product.data?.valueIdeas || [])]) {
      const title = String(idea.title || idea.label || '').trim()
      if (!title || idea.status === 'dropped') continue
      if (byKey.has(keyFor(title))) continue
      const id = idea.id || `idea-${hash(title)}`
      const node = nodes.find(item => item.id === id) || { id, type: 'value', label: title, status: idea.status || 'hypothesis', source: product.source,
        data: { ...idea, pain: idea.description || idea.pain, outcome: idea.expectedOutcome || idea.outcome }, ownerId: product.id, virtual: true }
      byKey.set(keyFor(title), node)
      if (!nodes.some(item => item.id === id)) virtual.push(node)
      for (const segmentId of idea.segmentIds || []) if (nodes.some(item => item.id === segmentId && item.type === 'segment')) virtualEdges.push({ from: segmentId, to: id, type: 'has_value', virtual: true })
    }
  }
  for (const segment of nodes.filter(node => node.type === 'segment')) {
    for (const idea of segment.data?.valueIdeas || []) {
      const title = String(idea.title || '').trim()
      if (!title) continue
      const key = keyFor(title)
      let node = byKey.get(key)
      if (!node) {
        node = {
          id: `value-${hash(key)}`, type: 'value', label: title, status: 'hypothesis',
          source: segment.source, data: { pain: idea.pain, outcome: idea.outcome, riskiestPart: idea.riskiestPart }, ownerId: segment.id, virtual: true,
        }
        byKey.set(key, node)
        virtual.push(node)
      }
      virtualEdges.push({ from: segment.id, to: node.id, type: 'has_value', virtual: true })
    }
  }
  return { nodes: nodes.concat(virtual), edges: edges.concat(virtualEdges) }
}

function nodeEvidence(nodeId, nodes, edges) {
  const byId = Object.fromEntries(nodes.map(node => [node.id, node]))
  return edges.filter(edge => ['evidenced_by', 'contradicted_by'].includes(edge.type) && edge.from === nodeId && byId[edge.to])
    .map(edge => ({ ...byId[edge.to], relation: edge.type }))
}

function moveKeysFor(node) {
  if (!node) return ['hq']
  if (node.status === 'dropped' || node.data?.retired) return []
  if (node.status === 'contradicted') return ['reconsider']
  if (node.type === 'segment') return ['deepResearch', 'walkthrough']
  if (node.type === 'assumption') return ['testRisk']
  if (node.type === 'competitor') return ['compare']
  if (node.type === 'value') return ['fieldValue']
  if (node.type === 'product') return ['hq']
  return []
}

function moveFor(key, node, workspace, extra = {}) {
  const base = MOVE_CATALOG[key] || MOVE_CATALOG.custom
  const catalog = extra.skill && SKILL_META[extra.skill] ? { ...base, ...SKILL_META[extra.skill], skill: extra.skill } : base
  const target = node || { id: 'product', type: 'product', label: path.basename(workspace) }
  const objective = extra.objective || extra.title || catalog.title
  const prompt = [
    `Работай в продуктовом воркспейсе: ${workspace}.`,
    catalog.skill === 'custom' ? `Выполни порученный ход «${objective}» доступными инструментами; не запускай навык с именем custom.` : `Запусти /${catalog.skill} и выполни ход «${objective}».`,
    `Целевой узел карты: ${target.label} (id: ${target.id}, тип: ${TYPE_LABELS[target.type] || target.type}).`,
    target.virtual && target.type === 'value' ? 'Это гипотеза развития, показанная из data.developmentHypotheses продукта или valueIdeas сегмента. Найди её по ID или названию в исходном графе; сохрани связи с сегментами и зависимости.' : '',
    extra.report ? `Разбери и забери в знания отчёт: ${extra.report}.` : '',
    extra.reason ? `Пробел, который нужно закрыть: ${extra.reason}` : '',
    `Ожидаемый результат: ${extra.output || catalog.output}.`,
    key === 'researchGap' ? 'Это уточнение существующего исследования. Исследуй только указанный вопрос для целевого узла; сохрани остальные результаты. Привяжи каждое новое утверждение к первичному источнику, укажи дату и область применимости. Если данных не найдено, запиши область поиска и оставшийся пробел, не выдумывай ответ.' : '',
    key === 'researchGap' ? `researchGap: ${JSON.stringify({ nodeId: target.id, section: extra.gapId, question: objective, expectedOutcome: extra.output || catalog.output })}` : '',
    key === 'researchGap' && extra.gapId === 'messaging' && target.type === 'competitor' ? `Сначала сними сайт кодом: node bin/landing-capture.js ${workspace} --ids ${target.id} (файлы появятся в sources/competitors/ с датой). Передай запись снимка в workflow как args.landingCapture, а в args.targetContext — текущие работы сегментов с ID (jobs), их критерии (criteria) и отличия продукта (differentiators). Цитаты только дословно из снимка; работы только из списка по ID. Если снимок unavailable, не выдумывай обещания: запиши причину.` : '',
    'Сначала прочитай PRODUCT.md и возьми из research-graph.json только нужный срез вокруг целевого узла.',
    'Не запускай следующие скиллы автоматически. В конце сообщи результат, изменённые артефакты, выполненную проверку и блокеры.',
  ].filter(Boolean).join('\n')
  return {
    id: extra.id || `${key}:${target.id}`,
    kind: key, title: extra.title || catalog.title, skill: catalog.skill,
    output: extra.output || catalog.output, duration: catalog.duration, minutes: catalog.minutes,
    node: { id: target.id, label: target.label, type: target.type, typeLabel: TYPE_LABELS[target.type] || target.type, statusLabel: STATUS_LABELS[target.status] || 'без статуса' },
    receiptNodeId: target.virtual && target.type === 'value' ? target.ownerId || target.id : target.id,
    objective, reason: extra.reason || '', gapId: extra.gapId || null, manualOnly: Boolean(extra.manualOnly), prompt,
  }
}

function shellQuote(value) {
  return `'${String(value).replace(/'/g, `'"'"'`)}'`
}

function attachFallback(move, workspace) {
  return {
    ...move,
    command: `cd -- ${shellQuote(workspace)} && claude --bg --name ${shellQuote(move.title)} ${shellQuote(move.prompt)}`,
  }
}

function cleanMoveTitle(text) {
  return text.split('\n')[0].replace(/\*\*/g, '').replace(/^~~|~~$/g, '').split(/\s+[—–]\s+/)[0].trim()
}

function chooseNodeForText(text, nodes, fallback) {
  const lower = text.toLocaleLowerCase('ru')
  return nodes.filter(node => node.label && lower.includes(node.label.toLocaleLowerCase('ru')))
    .sort((a, b) => b.label.length - a.label.length)[0] || fallback
}

function isFatalProductRisk(node, productIds, edges) {
  if (node.type !== 'assumption' || !['hypothesis', 'evidenced', 'contradicted'].includes(node.status) || node.data?.fatal !== true) return false
  const targets = edges.filter(edge => edge.type === 'about' && edge.from === node.id).map(edge => edge.to)
  return !targets.length || targets.some(target => productIds.has(target))
}

function projection(graph, workspace) {
  const sourceNodes = Array.isArray(graph.nodes) ? graph.nodes : []
  const rawNodes = sourceNodes.length ? sourceNodes : [{
    id: 'workspace-product', type: 'product',
    label: firstHeading(safeRead(path.join(workspace, 'PRODUCT.md')), path.basename(workspace)),
    status: 'hypothesis', source: 'PRODUCT.md', virtual: true,
  }]
  const rawEdges = Array.isArray(graph.edges) ? graph.edges : []
  const augmented = valueNodes(rawNodes, rawEdges)
  const nodes = augmented.nodes.map(node => ({
    ...node,
    typeLabel: TYPE_LABELS[node.type] || node.type,
    statusLabel: STATUS_LABELS[node.status] || node.status || 'без статуса',
  }))
  const byId = Object.fromEntries(nodes.map(node => [node.id, node]))
  let product = nodes.find(node => node.type === 'product')
  if (!product && nodes.length) product = nodes[0]
  const productIds = new Set(nodes.filter(node => node.type === 'product').map(node => node.id))
  const segments = nodes.filter(node => node.type === 'segment')
  const competitors = nodes.filter(node => node.type === 'competitor')
  const risks = nodes.filter(node => isFatalProductRisk(node, productIds, augmented.edges))
  const overviewEdges = []
  if (product) {
    for (const node of [...segments, ...competitors, ...risks]) overviewEdges.push({ from: product.id, to: node.id, type: 'overview', virtual: true })
  }
  const edges = augmented.edges.concat(overviewEdges)
  const evidenceByNode = new Map()
  for (const edge of augmented.edges) if (['evidenced_by', 'contradicted_by'].includes(edge.type) && byId[edge.to]) {
    if (!evidenceByNode.has(edge.from)) evidenceByNode.set(edge.from, [])
    evidenceByNode.get(edge.from).push({...byId[edge.to], relation:edge.type})
  }
  const graphNodes = nodes.map(node => {
    const evidence = (evidenceByNode.get(node.id) || []).map(item => ({ id: item.id, label: item.label, relation: item.relation, source: item.source }))
    const context = node.data?.context || node.data?.pain || node.data?.outcome || node.data?.calculation || ''
    const importance = node.type === 'assumption'
      ? (node.data?.fatal ? 'Если риск не выдержит проверку, продукт или выбранный сегмент может потерять смысл.' : 'Этот риск держит на себе часть решения и пока не закрыт фактами.')
      : node.type === 'segment'
        ? (node.data?.rank ? `Сегмент занимает место №${node.data.rank} в текущем рейтинге.` : 'Это одна из проверяемых гипотез о том, кому продукт нужнее всего.')
        : node.type === 'competitor'
          ? 'Клиенты уже нанимают это решение для части тех же задач — его сильные стороны задают планку.'
          : node.type === 'value'
            ? 'Эта идея ценности связывает конкретную боль сегмента с изменением продукта.'
            : 'Узел связан с текущими выводами и влияет на следующий ход.'
    return {
      ...node, context, importance, evidence,
      moveKeys: moveKeysFor(node),
      facts: {
        ltvToCac: node.data?.economicsUnpriced ? null : node.data?.ltvToCac,
        economicsUnpriced: Boolean(node.data?.economicsUnpriced),
        verifiedPercent: node.type === 'segment' ? verificationOf(node.id, nodes, augmented.edges).percent : null,
        interviewCount: node.type === 'segment' ? verificationOf(node.id, nodes, augmented.edges).interviews : null,
        rank: node.data?.rank || null,
        fatal: Boolean(node.data?.fatal),
      },
    }
  })
  // Normalize labels once, preserving graph order and the same first ten matches.
  const mentionCandidates = graphNodes.filter(node => node.label).map(node => ({id:node.id,label:node.label,normalized:node.label.toLocaleLowerCase('ru')}))
  for (const node of graphNodes) {
    const text = `${node.context || ''} ${node.importance || ''}`.toLocaleLowerCase('ru')
    node.mentions = []
    for (const other of mentionCandidates) if (other.id !== node.id && text.includes(other.normalized)) {
      node.mentions.push({id:other.id,label:other.label})
      if (node.mentions.length === 10) break
    }
  }
  return { nodes: graphNodes, edges, product, empty: sourceNodes.length === 0, groups: { risks: risks.map(x => x.id), segments: segments.map(x => x.id), competitors: competitors.map(x => x.id) }, byId }
}

function suggestionCandidates(projected, reports, threadItems, moves = {}) {
  const { edges, product } = projected
  const nodes = projected.nodes.filter(n => n.status !== 'dropped' && !n.data?.retired)
  const productIds = new Set(nodes.filter(node => node.type === 'product').map(node => node.id))
  const waiting = threadItems.filter(item => item.status === 'waiting').map(item => ({
    id: `waiting:${item.launchId || item.id}`, priority: 0, reason: 'Агент остановился и не может продолжить без твоего ответа.',
    move: item.move, node: projected.byId[item.node.id] || product, threadId: item.threadId, action: 'open',
  }))
  const fatal = nodes.filter(node => isFatalProductRisk(node, productIds, edges)).map(node => ({
    id: `fatal:${node.id}`, priority: 1,
    reason: [node.data?.whyFundamental || node.data?.context || 'Это допущение определяет, сможет ли продукт работать.', node.data?.consequence || 'Последствия отмечены как критические, а результат проверки ещё не зафиксирован.', node.data?.testMethod ? `Предлагаемый способ проверки: ${node.data.testMethod}` : 'Нужно определить способ проверки и измеримый порог отказа.'].join(' '),
    move: moveFor('testRisk', node, ''), node,
  }))
  const staleAfter = Date.now() - 90 * 24 * 60 * 60 * 1000
  const stale = nodes.filter(node => ['validated', 'evidenced'].includes(node.status) && node.data?.updatedAt && new Date(node.data.updatedAt).getTime() < staleAfter).map(node => ({
    id: `stale:${node.id}`, priority: 2,
    reason: 'Подтверждение устарело: рынок мог измениться, а решение всё ещё опирается на старые данные.',
    move: moveFor(node.type === 'segment' ? 'deepResearch' : 'hq', node, ''), node,
  }))
  const research = nodes.filter(node => ['segment', 'competitor'].includes(node.type)).flatMap(node => {
    const move = (moves[node.id] || []).find(item => ['researchGap', 'segmentDefinition'].includes(item.kind) && !item.manualOnly)
    return move ? [{ id: `${node.type}:${node.id}:${move.gapId}`, priority: node.type === 'segment' ? 3 : 4, reason: move.reason, move, node }] : []
  })
  const fallback = product ? [{
    id: `hq:${product.id}`, priority: 9,
    reason: reports.length ? 'Карта изменилась — полезно сверить состояние и получить один следующий ход.' : 'Сначала собери состояние продукта и выбери самый дешёвый способ снять неопределённость.',
    move: moveFor('hq', product, ''), node: product,
  }] : []
  return [...waiting, ...fatal, ...stale, ...research, ...fallback]
}

function loadReceipts(workspace) {
  const root = path.join(workspace, '.product-os', 'runs')
  return walkFiles(root, file => file.endsWith('.json')).map(file => {
    try { const r = JSON.parse(fs.readFileSync(file, 'utf8')); return path.basename(file) === `${r.runId}.json` ? r : null }
    catch { return null }
  }).filter(Boolean)
}

function mapThreadStatus(launch, thread, reports, receipts = []) {
  const elapsed = Math.max(0, Math.floor((Date.now() - (Number(launch.startedAt) || Date.now())) / 60000))
  const receipt = receipts.find(r => r.runId === (launch.runId || launch.id) && r.nodeId === (launch.move?.receiptNodeId || launch.move?.node?.id) && r.skill === launch.move?.skill)
  const report = receipt?.report ? reports.find(r => r.path === receipt.report) || null : null
  let status = 'unknown', failure = null
  if (receipt && (report || receipt.summary) && ['completed', 'failed'].includes(receipt.outcome)) {
    status = receipt.outcome === 'completed' ? 'done' : 'failed'
    failure = status === 'failed' ? receipt.summary || 'Исследование завершилось с ошибкой.' : null
  } else if (launch.statusOverride === 'stopped') { status = 'stopped'; failure = 'Работа остановлена вами.' }
  else if (launch.launchState === 'failed') { status = 'failed'; failure = launch.error }
  else if (thread?.hasPendingInteraction) status = 'waiting'
  else if (['failed', 'error', 'stopped', 'cancelled'].includes(thread?.status)) { status = 'failed'; failure = thread.error || 'Агент завершил работу с ошибкой или был остановлен.' }
  else if (['active', 'running', 'busy', 'starting', 'working'].includes(thread?.status)) status = 'running'
  else if (['idle', 'completed', 'done'].includes(thread?.status)) { status = 'incomplete'; failure = 'Агент остановился, но результат этого запуска ещё не записан.' }
  else failure = launch.error || 'Статус агента пока неизвестен. Проверь существующую работу перед повторным запуском.'
  return { status, elapsed, failure, report, receipt, long: status === 'running' && elapsed > (Number(launch.move?.minutes) || 8) * 2 }
}

function todoItems(workspace, projected, reports, state, threads, receipts = loadReceipts(workspace)) {
  const byThread = new Map((threads || []).map(thread => [thread.id, thread]))
  const product = projected.product || projected.nodes[0]
  const base = []
  for (const [index, item] of parseMoves(safeRead(path.join(workspace, 'MOVES.md'))).entries()) {
    if (item.done || /сделано|отброшено/i.test(item.section)) continue
    const title = cleanMoveTitle(item.text)
    const node = projected.byId[item.nodeId] || chooseNodeForText(item.text, projected.nodes, product)
    const key = item.kind || (node?.type === 'assumption' ? 'testRisk' : node?.type === 'competitor' ? 'compare' : node?.type === 'segment' ? 'deepResearch' : 'custom')
    const output = item.expectedOutcome || item.output || item.text.match(/(?:Ожидаемый результат|На выходе|Результат):\s*([^\n]+)/i)?.[1]
    const clarifications = explainMoveIssues(item)
    const move = moveFor(key, node, workspace, { id: item.id, title, objective: item.objective || item.text, output: output || (key === 'custom' ? 'Ожидаемый результат пока не описан в плане задачи.' : undefined), reason: item.reason, gapId: item.gapId })
    const itemSkill = item.skill === 'product-hq' ? (item.kind === 'hq' ? 'product-status' : item.kind === 'ingest' ? 'product-context' : 'custom') : item.skill
    if (itemSkill && SKILL_META[itemSkill]) { move.skill = itemSkill; move.prompt = `Запусти /${itemSkill}.\n` + move.prompt.replace(/^Запусти \/[^\n]+\n?/m, '') }
    const clarifyMove = item.executionReady === false ? attachFallback(moveFor('custom', node, workspace, {
      id: `clarify:${item.id}`, title: `Уточнить план: ${title}`, objective: `Уточни существующую задачу ${item.id} в MOVES.md, сохрани её ID. ${clarifications.join(' ')} Не выполняй исходную задачу до уточнения.`,
      output: 'В той же задаче записаны ожидаемый результат, ответственный, зависимости и недостающие условия; статус готовности обновлён по фактической полноте плана', reason: clarifications.join(' '),
    }), workspace) : null
    base.push({ id: move.id, source: 'MOVES.md', move, clarifyMove, node: move.node, owner: item.owner || null, clarifications, status: item.executionReady === false ? 'blocked' : 'ready', failure: item.executionReady === false ? clarifications.join(' ') : null, order: index })
  }
  const launches = state.launches.map(launch => {
    const mapped = mapThreadStatus(launch, byThread.get(launch.threadId), reports, receipts)
    const move = { ...launch.move, prompt: launch.prompt || launch.move?.prompt }
    return { id: launch.moveId, launchId: launch.id, source: 'Консоль', move, node: move.node, threadId: launch.threadId, provider: launch.provider || 'bb', ...mapped }
  })
  const latestByMove = new Map()
  for (const launch of launches) {
    const current = latestByMove.get(launch.id)
    if (!current || state.launches.findIndex(x => x.id === launch.launchId) > state.launches.findIndex(x => x.id === current.launchId)) latestByMove.set(launch.id, launch)
  }
  const combined = base.map(item => latestByMove.get(item.id) || item)
  for (const launch of launches) if (!combined.some(item => item.launchId === launch.launchId || item.id === launch.id)) combined.push(launch)
  const statusOrder = { waiting: 0, failed: 1, unknown: 2, incomplete: 2, running: 3, ready: 4, done: 5 }
  return combined.sort((a, b) => (statusOrder[a.status] ?? 9) - (statusOrder[b.status] ?? 9) || (a.order ?? 999) - (b.order ?? 999))
}

function buildSnapshot({ workspace, repoRoot, graph, graphStatus, state, threads, capabilities, scope = '', researchRecords, view = '' }) {
  const publicEdition = isPublicEdition(repoRoot)
  const productName = firstHeading(safeRead(path.join(workspace, 'PRODUCT.md')), graph.product || path.basename(workspace))
  // Identity and the strategic board have their own scoped readers. Do not build
  // reports, communications, dossiers and suggestions just to obtain their shell.
  // The explicit view marker prevents this subset being used by other routes.
  if (['identity','library','jobs'].includes(view)) {
    const product = graph.nodes.find(node => node.type === 'product')
    const nodes = product ? [{ id: product.id, type: product.type, label: product.label, status: product.status, source: product.source }] : []
    return { snapshotView: view, generatedAt: Date.now(), workspace, productName, graphStatus, capabilities,
      graph: { nodes, edges: [], productId: product?.id || null, empty: !product },
      galaxy: buildGalaxyProjection({ nodes, edges: [], productId: product?.id || null }),
      // Counts are unknown in this view, rather than asserted to be zero.
      badges: {}, humanWork: {},
    }
  }
  // Preserve legacy records on disk without publishing a removed feature.
  const omitted = new Set(graph.nodes.filter(node => ['channel','journey','touchpoint','rubric','reference','communication_decision'].includes(node.type) || ['communication_material','content-pack','channel-concept','editorial-profile'].includes(node.data?.kind)).map(node => node.id))
  const projected = projection({...graph,nodes:graph.nodes.filter(node=>!omitted.has(node.id)),edges:graph.edges.filter(edge=>!omitted.has(edge.from)&&!omitted.has(edge.to))}, workspace)
  projected.nodes = require('./consideration').withConsideration(projected.nodes, researchRecords || require('../research/store').load(workspace).records)
  const reports = loadReports(workspace, projected.nodes)
  const todo = todoItems(workspace, projected, reports, state, threads)
  const galaxyInput = { nodes: projected.nodes, edges: projected.edges.filter(edge => edge.type !== 'overview'), productId: projected.product?.id || null }
  // Screenshot thumbnails for legacy snapshots exist only if the file is really there.
  const fileExists = relative => { try { return fs.existsSync(path.join(workspace, relative)) } catch { return false } }
  const draftGalaxy = buildGalaxyProjection({ ...galaxyInput, fileExists })
  const dossiers = new Map([...(draftGalaxy.segments || []), ...(draftGalaxy.competitors || []), ...(draftGalaxy.product ? [draftGalaxy.product] : [])].map(item => [item.id, item]))
  const moves = {}
  for (const node of projected.nodes) {
    const gaps = dossierGaps(node, dossiers.get(node.id))
    const actions = gaps.map(gap => {
      const sectionStatus = gap.status || node.data?.researchSections?.[gap.id]?.status
      const alreadyRun = todo.some(item => item.node?.id === node.id && item.move?.gapId === gap.id && item.status === 'done')
      const manualOnly = sectionStatus === 'researched' || alreadyRun
      return moveFor(gap.kind || 'researchGap', node, workspace, {
      id: `researchGap:${node.id}:${gap.id}`, gapId: gap.id, title: `${manualOnly ? 'Повторно: ' : ''}${gap.action || gap.label}`, manualOnly,
      objective: gap.action || gap.label, reason: gap.reason || gap.label, output: gap.output || `Обновлённый раздел «${gap.label || gap.id}»: вывод, первичные источники и оставшиеся неизвестные`,
    }) })
    const regular = moveKeysFor(node).filter(key => !['deepResearch', 'compare'].includes(key))
    moves[node.id] = [...actions, ...regular.map(key => moveFor(key, node, workspace))].filter(move => !publicEdition || PUBLIC_SKILLS.includes(move.skill)).map(move => attachFallback(move, workspace))
  }
  const candidates = suggestionCandidates(projected, reports, todo, moves).filter(item => !publicEdition || PUBLIC_SKILLS.includes(item.move?.skill)).sort((a, b) => a.priority - b.priority || a.id.localeCompare(b.id))
  const graphSignature = digest(graph)
  const canonical = parseMoves(safeRead(path.join(workspace, 'MOVES.md')))
  const active = todo.filter(item => !['done', 'failed', 'stopped'].includes(item.status))
  const fingerprint = item => {
    const links = projected.edges.filter(e => e.from === item.node.id || e.to === item.node.id).filter(e => !e.virtual)
    const ids = new Set(links.flatMap(e => [e.from, e.to]))
    ids.add(item.node.id)
    return digest({ nodes: graph.nodes.filter(n => ids.has(n.id) && n.type !== 'move'), edges: links.filter(e => e.type !== 'tests') })
  }
  const suggestions = candidates.map(item => ({ ...item, fingerprint: fingerprint(item) })).filter(item => {
    const sameDecision = decision => typeof decision === 'object' && decision?.fingerprint === item.fingerprint
    if (sameDecision(state.deck.rejected[item.id]) || sameDecision(state.deck.deferred[item.id])) return false
    if (canonical.some(row => row.suggestionId === item.id && (row.fingerprint === item.fingerprint || !row.done))) return false
    if (item.action !== 'open' && active.some(row => row.node?.id === item.node.id && row.move?.skill === item.move.skill)) return false
    return true
  }).map(item => {
    const move = item.action === 'open' ? { ...item.move, action: 'open', threadId: item.threadId } : moveFor(item.move.kind, item.node, workspace, { id: `suggestion:${item.id}`, title: item.move.title, objective: item.move.objective, output: item.move.output, reason: item.reason, gapId: item.move.gapId })
    return { id: item.id, priority: item.priority, reason: item.reason, fingerprint: item.fingerprint, action: item.action, threadId: item.threadId, node: move.node, move: attachFallback(move, workspace) }
  })
  const first = suggestions[0]
  const recommended = first ? { suggestionId: first.id, nodeId: first.node.id, title: first.move.title, reason: first.reason } : null
  const activeNodes = projected.nodes.filter(n => !n.data?.retired && n.status !== 'dropped')
  const metrics = {
    debt: activeNodes.filter(node => node.status === 'hypothesis' && ['assumption', 'criterion'].includes(node.type)).length,
    fatal: activeNodes.filter(node => isFatalProductRisk(node, new Set(activeNodes.filter(item => item.type === 'product').map(item => item.id)), projected.edges)).length,
    contradicted: activeNodes.filter(node => node.status === 'contradicted').length,
    confirmed: activeNodes.filter(node => ['evidenced', 'validated'].includes(node.status)).length,
    segments: activeNodes.filter(node => node.type === 'segment').length,
  }
  const galaxy = buildGalaxyProjection({ ...galaxyInput, moves, fileExists })
  const profileSources = require('./customer-profile-sources').customerProfileSources(workspace, projected.nodes)
  for (const segment of galaxy.segments) segment.customerProfile = profileSources(segment.customerProfile, [segment.customerProfileSource, projected.nodes.find(node => node.id === segment.id)?.source])
  return {
    audienceIdeas: require('./audience-ideas').audienceIdeas(workspace, graph),
    researchCounts:{people:(researchRecords||[]).filter(r=>r.type==='Person').length,sessions:(researchRecords||[]).filter(r=>r.type==='Session'&&r.status==='completed').length},
    generatedAt: Date.now(), workspace, productName, graphStatus, graphSignature, capabilities,
    metrics, graph: { nodes: projected.nodes, edges: projected.edges, productId: projected.product?.id || null, empty: projected.empty, groups: projected.groups },
    moves, hqMove: projected.product ? attachFallback(moveFor('hq', projected.product, workspace), workspace) : null,
    recommended, todo, suggestions, reports, galaxy, humanWork: state.humanWork || {},
    skills: loadSkills(repoRoot), skillGroups: SKILL_GROUPS,
    sources: graph.nodes.filter(node => node.type === 'artifact' && node.data?.kind === 'source-material').map(node => ({ id: node.id, name: node.label, source: node.source, bytes: node.data.bytes })),
    badges: {
      next: todo.filter(item => item.status !== 'done').length,
      waiting: todo.some(item => item.status === 'waiting'),
    },
  }
}

module.exports = {
  MOVE_CATALOG, SKILL_META, SKILL_GROUPS, TYPE_LABELS, STATUS_LABELS, attachFallback, buildSnapshot,
  hash, humanSkillName, loadArena, loadReports, moveFor, parseFrontmatter, parseMoves,
  projection, reportSummary, shellQuote, todoItems, mapThreadStatus, loadReceipts,
}
