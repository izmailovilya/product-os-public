#!/usr/bin/env node
// Regenerate segments/*.md passports from research-graph.json (derived view, like the pages).
//   node bin/segments.js [path/to/workspace]
const fs = require('fs')
const path = require('path')
const { verificationOf } = require('./verification')
const { marketSizeScore } = require('./research-quality')

const ws = path.resolve(process.argv[2] || '.')
const g = JSON.parse(fs.readFileSync(path.join(ws, 'research-graph.json'), 'utf8'))
const by = {}; (g.nodes || []).forEach(n => { by[n.id] = n })
const E = g.edges || []
const outs = (i, t) => E.filter(e => e.from === i && e.type === t && by[e.to]).map(e => by[e.to])
// criteria of a (segment, job) pair — GRAPH.md v2: the ordered list lives on the performs edge;
// v1 graphs fall back to the job's judged_by list
const critsOf = segId => {
  const res = []
  for (const pe of E.filter(e => e.from === segId && e.type === 'performs' && by[e.to])) {
    const j = by[pe.to]
    const listed = pe.data && Array.isArray(pe.data.criteria) && pe.data.criteria.length
      ? pe.data.criteria.slice().sort((a, b) => (a.priority || 99) - (b.priority || 99)).map(c => by[c.id]).filter(Boolean)
      : null
    res.push([j, listed || outs(j.id, 'judged_by')])
  }
  return res
}
// sub-segments (GRAPH.md, sub-segments): sub --sub_segment_of--> parent,
// the delta (sharper context, added criteria, triggers) lives on that edge
const parentEdgeOf = segId => E.find(e => e.from === segId && e.type === 'sub_segment_of' && by[e.to])
const subEdgesOf = segId => E.filter(e => e.to === segId && e.type === 'sub_segment_of' && by[e.from])
const addedCritIds = segId => new Set((((parentEdgeOf(segId) || {}).data || {}).addedCriteria || []).map(c => c.id))
const ST = { hypothesis: 'гипотеза', evidenced: 'есть полевые свидетельства', validated: 'подтверждён в поле', contradicted: 'ОПРОВЕРГНУТ', dropped: 'отброшен' }
const CV = { hypothesis: 'гипотеза', evidenced: 'подтверждён полем', validated: 'проверен с клиентами', contradicted: 'ОПРОВЕРГНУТ' }
const ins2 = (i, t) => E.filter(e => e.to === i && e.type === t && by[e.from]).map(e => by[e.from])
// «Чем решают сейчас» — собственный список сегмента из поля: segment --hires--> competitor
// (включая «своими руками» и «ничего не делают»). Отсутствует в старых графах — тогда
// печатается старый data.currentSolutions.
const HIRE_KIND = { direct: 'прямой конкурент', indirect: 'косвенный', diy: 'своими руками', do_nothing: 'ничего не делают' }
const HIRE_PREV = { dominant: 'чаще всего', common: 'часто', rare: 'редко' }
const PREV_ORDER = { dominant: 0, common: 1, rare: 2 }
const hiresOf = segId => E.filter(e => e.from === segId && e.type === 'hires' && by[e.to])
  .map(e => ({ n: by[e.to], d: e.data || {} }))
  .sort((a, b) => (PREV_ORDER[a.d.prevalence] ?? 9) - (PREV_ORDER[b.d.prevalence] ?? 9))
// люди и бюджет сегмента (GRAPH: peopleCount / spendTodayUsdMonthly / impliedAnnualSpendUsd) —
// печатаются только как конечные числа > 0; ноль или пусто = «не посчитано», не «0»
const BASIS = { sourced: 'по источнику', derived: 'расчёт из источников' }
const posNum = v => { const n = Number(v); return Number.isFinite(n) && n > 0 ? n : null }
const fmtInt = n => Math.round(n).toLocaleString('ru-RU')

// ---------- small formatting helpers shared by the passport ----------
const isHttp = u => /^https?:\/\//i.test(String(u))
const money = v => v >= 1e9 ? `$${(v / 1e9).toFixed(1)}B` : v >= 1e6 ? `$${Math.round(v / 1e6)}M` : v >= 1e3 ? `$${Math.round(v / 1e3)}K` : `$${v}`

// «как посчитаны цифры» — вывод каждой считаемой цифры с подставленными числами, одним
// списком строк (markdown-жирный), который md-паспорт печатает как есть, а html — как <p>.
// Арифметика фиксирована в коде; входы-оценки агента честно названы оценками.
const num = v => typeof v === 'number' && Number.isFinite(v) ? v : null
const knownNum = (v, d) => d.scoringVersion === 2 ? num(v) : posNum(v)
const SATUR = { low: 'низкая', medium: 'средняя', high: 'высокая' }
const marketSizeScoreView = marketSizeScore

function calcExplainLines(d) {
  const b = d.scoringBreakdown || {}
  const c = b.computed || {}
  const f = b.forces || {}
  const comp = b.competition || {}
  const adv = b.advantage || {}
  const fe = b.fieldEvidence || {}
  const eco = d.economics || {}
  const P = []
  const sw = num(c.switchScore ?? d.switchScore)
  if (sw !== null && num(f.addedValue) !== null)
    P.push(`**Готовность переключиться = ${sw}.** (ценность нового ${num(f.addedValue)} + острота боли ${num(f.problemSeverity)}) − (барьеры перехода ${num(f.barriers)} + сила привычки ${num(f.habitStrength)}). Больше 50 — активно ищут замену, меньше 0 — держатся за текущее. Четыре силы (0–100) — оценки агента по полевым находкам.`)
  const price = num(eco.monthlyPriceUsd), cogs = num(eco.monthlyCogsUsd), life = num(eco.lifetimeMonths), cac = num(eco.cacUsd), ltv = num(d.ltvToCac)
  if (d.scoringVersion === 2) {
    const scenario = d.economicScenario || {}
    P.push(scenario.status === 'scenario'
      ? `**Экономический сценарий:** (цена $${price}/мес − себестоимость $${cogs}/мес) × ${life} мес = $${scenario.contribution} маржинального дохода; CAC $${cac}. LTV:CAC: ${ltv ?? 'не определено при CAC = 0'}. Диапазон маржинального дохода: $${scenario.range?.contribution?.low}–$${scenario.range?.contribution?.high}. Это сценарий по указанным источникам, а не обещание возврата инвестиций.`
      : `**Экономика неизвестна.** Не хватает проверенных входов: ${(scenario.missing || []).join(', ')}. Расходы клиента на альтернативы не задают цену нашего продукта.`)
  } else if (d.economicsUnpriced)
    P.push(`**Экономика не считалась.** Реальной цены нет — ни в прайсе продукта, ни в том, что сегмент платит сейчас, — а считать по выдуманной цифре запрещено. Вес экономики в общем балле перераспределён на остальные оценки.`)
  else if (ltv !== null && price !== null && cogs !== null && life !== null && cac !== null) {
    const amppu = num(c.amppuUsd) ?? Math.round((price - cogs) * life)
    const basis = eco.priceBasis === 'product-pricing' ? ' Цена — из реального прайса продукта.' : eco.priceBasis === 'customers-pay-today' ? ' Цена — то, что сегмент уже платит за текущие решения.' : ''
    P.push(`**LTV:CAC = ${ltv}.** Доход с одного клиента за всё время: (цена $${price}/мес − себестоимость $${cogs}/мес) × срок жизни ${life} мес = $${amppu}. Делим на стоимость привлечения $${cac} → ${ltv}: каждый $1, вложенный в привлечение, возвращает ~$${ltv}.${basis}${eco.priceSource ? ` Откуда цена: ${eco.priceSource}.` : ''}`)
    if (eco.calculation) P.push(`**Как оценивались входные числа:** ${eco.calculation}`)
  }
  const total = num(d.totalScore), vd = num(c.valueDelivery), cs = num(c.competitionScore), as2 = num(c.advantageScore), eh = num(c.econHealth)
  const ms = num(c.marketScore) ?? (num(d.somValueUsd) !== null ? marketSizeScoreView(num(d.somValueUsd)) : null)
  if (total !== null && vd !== null && cs !== null && as2 !== null) {
    P.push(d.scoringVersion === 2
      ? `**Привлекательность ${total}/100.** (0,20 × рынок ${ms ?? '—'} + 0,30 × ценность ${vd} + 0,15 × конкуренция ${cs} + 0,10 × преимущество ${as2}) / 0,75. Экономический сценарий рассматривается отдельно у всех сегментов. Субъективные компоненты — оценки, не измеренные вероятности.`
      : (d.economicsUnpriced || eh === null)
      ? `**Балл ${total}/100.** Взвешенная сумма: 20% размер рынка (${ms ?? '—'}) + 30% ценность против альтернатив (${vd}) + 15% свобода от конкурентов (${cs}) + 10% уникальность и барьеры (${as2}); экономика без цены не считалась — её 25% веса распределены на остальные. Формула одна для всех сегментов и зашита в код.`
      : `**Балл ${total}/100.** Взвешенная сумма: 20% размер рынка (${ms ?? '—'}) + 30% ценность против альтернатив (${vd}) + 25% здоровье экономики (${eh}) + 15% свобода от конкурентов (${cs}) + 10% уникальность и барьеры (${as2}). Формула одна для всех сегментов и зашита в код.`)
    const bits = []
    if (num(comp.competitorCount) !== null) bits.push(`−5 за каждого из ${num(comp.competitorCount)} конкурентов (максимум −50)`)
    if (comp.hasGiants) bits.push('−25 за гигантов на рынке')
    if (comp.hasMediumPlayers) bits.push('−15 за средних игроков')
    if (SATUR[comp.saturation]) bits.push(`−${comp.saturation === 'high' ? 20 : comp.saturation === 'medium' ? 10 : 0} за насыщенность (${SATUR[comp.saturation]})`)
    if (bits.length) P.push(`**Свобода от конкурентов = ${cs}.** Старт со 100, дальше ${bits.join(', ')}; итог не выходит за пределы 0–100.`)
    if (num(adv.uniqueness) !== null) P.push(`**Уникальность и барьеры = ${as2}.** Уникальность ${num(adv.uniqueness)}/100 × 0,6 + барьеры для копирования («${String(adv.barriersToEntry || '—')}») × 0,4 — оценка агента по фактам о конкурентах.`)
  }
  if (num(fe.total)) P.push(`**Сигнал из открытых источников: ${Math.round((num(fe.ratio) ?? 0) * 100)}% критериев.** Из ${num(fe.total)} критериев гипотезы чужие отзывы в сети нашлись под ${num(fe.evidenced) ?? 0}${num(fe.contradicted) ? `, противоречат ${num(fe.contradicted)}` : ''}. Это ворота 2 («проблема есть на рынке»), а не подтверждение нашими клиентами.`)
  // люди × бюджет — из источников, не из головы; поле есть, но пустое → честное «не посчитано»
  const people = knownNum(d.peopleCount, d), spend = knownNum(d.spendTodayUsdMonthly, d), annual = knownNum(d.impliedAnnualSpendUsd, d)
  if (people !== null) P.push(`**Людей в сегменте = ${fmtInt(people)}.** ${BASIS[d.peopleBasis] || (d.peopleBasis ? String(d.peopleBasis) : 'основание не указано')}${d.peopleSource ? ` — источник: ${d.peopleSource}` : ''}.`)
  else if (d.peopleCount !== undefined) P.push('**Людей: не посчитано.** Источника с числом людей в сегменте не нашлось — цифру не выдумываем.')
  if (spend !== null) P.push(`**Бюджет на задачу = $${fmtInt(spend)}/мес.** Сколько один клиент платит сегодня за текущие решения${BASIS[d.spendBasis] ? ` — ${BASIS[d.spendBasis]}` : d.spendBasis ? ` — ${String(d.spendBasis)}` : ''}${d.spendSource ? `; источник: ${d.spendSource}` : ''}.`)
  else if (d.spendTodayUsdMonthly !== undefined) P.push('**Бюджет на задачу: не посчитано.** Реальной суммы, которую сегмент платит сегодня, в источниках нет.')
  if (annual !== null) P.push(`**≈ ${money(annual)} в год на весь сегмент.** ${people !== null && spend !== null ? `Люди ${fmtInt(people)} × бюджет $${fmtInt(spend)}/мес × 12 мес.` : 'Люди × бюджет × 12 мес.'} Это то, что сегмент уже тратит на задачу, а не наш доход.`)
  return P
}
const dir = path.join(ws, 'segments')
fs.mkdirSync(dir, { recursive: true })
let count = 0
const ins = (i, t) => E.filter(e => e.to === i && e.type === t && by[e.from]).map(e => by[e.from])
const switchWords = v => v > 50 ? 'активно ищут замену' : v >= 0 ? 'присматриваются к замене' : 'держатся за текущее (инерция)'
for (const s of (g.nodes || []).filter(n => n.type === 'segment')) {
  if (!/^[A-Za-z0-9._-]+$/.test(String(s.id))) { console.warn(`Skipping segment with unsafe id: ${s.id}`); continue }
  const jobs = outs(s.id, 'performs')
  const d = s.data || {}
  const L = [`# ${s.label}`, '',
    `*Статус: **${ST[s.status] || s.status || '—'}** · паспорт собран из research-graph.json · id: \`${s.id}\`*`, '']
  // подсегмент («страна»): шапка со ссылкой на родителя + что именно добавляет контекст
  const parentE = parentEdgeOf(s.id)
  if (parentE) {
    const parent = by[parentE.to]; const pd = parentE.data || {}
    L.push(`**Подсегмент [${parent.label}](./${parent.id}.md)** — ${pd.basis==='observable_context'?'более конкретные обстоятельства внутри группы; задачи и критерии определяются условиями, подтверждение спроса не наследуется.':'уточнение прежней модели критериев; порядок требует проверки по источникам.'}`, '')
    if (pd.sharperContext) L.push(`- **Чем контекст острее:** ${pd.sharperContext}`)
    if (pd.triggers && pd.triggers.length) L.push(`- **Триггеры входа в покупку:** ${pd.triggers.join('; ')}`)
    const addedLbl = (pd.addedCriteria || []).map(c => by[c.id]).filter(Boolean).map(c => `«${c.label}»`)
    if (addedLbl.length) L.push(`- **Критерии, которые добавляет этот контекст:** ${addedLbl.join(', ')}`)
    L.push('')
  }
  if(d.customerProfile){
    const p=d.customerProfile, basis={hypothesis:'гипотеза',team:'со слов команды',research:'по материалам',unknown:'неизвестно'}
    const fact=f=>`${f.text} (${basis[f.basis]}; ${f.sourceRefs.join(', ')||'источник не связан'})`
    L.push(`**Группа: ${p.group.label}**`,'',fact(p.summary),'',fact(p.context),'')
    for(const [title,f] of [['Как узнать',p.recognition],['Почему выделен отдельно',p.whySeparate],['Основная задача',p.primaryJob],['Вклад продукта',p.productFit],['Текущие решения',p.alternatives]])L.push(`## ${title}`,'',fact(f),'')
    for(const [title,items] of [['Критерии успеха',p.successCriteria],['Другие задачи',p.otherJobs]])L.push(`## ${title}`,'',...items.map(f=>'- '+fact(f)),'')
    L.push('## Как приходят и остаются','')
    for(const [key,title] of [['trigger','Повод искать'],['discovery','Где узнают'],['firstUse','Первая проба'],['purchase','Оплата'],['retention','Повторное использование']])L.push(`- **${title}:** ${fact(p.journey[key])}`)
    L.push('','## Роли','');for(const [key,title] of [['user','Пользуется'],['decisionMaker','Выбирает'],['payer','Платит']])L.push(`- **${title}:** ${fact(p.roles[key])}`)
    L.push('','## Что выяснить','',...p.unknowns.map(t=>'- '+t),'')
  }
  // headline numbers — everything the research already computed
  const facts = []
  if (d.rank) facts.push(`**ранг ${d.rank}**` + (num(d.totalScore) !== null ? ` (балл ${d.totalScore}/100)` : '') + (d.scoringVersion === 2 && !d.ranking?.stable ? ' — предварительный порядок' : ''))
  if (d.totalScoreRange) facts.push(`диапазон привлекательности: ${d.totalScoreRange.low}–${d.totalScoreRange.high}/100`)
  if (d.researchReview && d.researchReview.decision !== 'retain') facts.push(`границы сегмента требуют проверки: ${d.researchReview.reason}`)
  if (num(d.switchScore) !== null) facts.push(`готовность переключиться: ${switchWords(d.switchScore)}`)
  if (d.economicsUnpriced) {
    facts.push('**экономика не считалась — реальной цены нет** (в балле сегмента она не участвует)')
  } else if (Number.isFinite(d.ltvToCac)) {
    const eco = d.economics || {}
    const detail = [eco.monthlyPriceUsd && `цена $${eco.monthlyPriceUsd}/мес`, eco.lifetimeMonths && `срок жизни ${eco.lifetimeMonths} мес`, eco.cacUsd && `CAC $${eco.cacUsd}`].filter(Boolean).join(', ')
    facts.push(`экономика LTV:CAC ≈ ${d.ltvToCac}` + (detail ? ` (${detail})` : ''))
  }
  if (num(d.somValueUsd) !== null) facts.push(`достижимый рынок (SOM): ${money(d.somValueUsd)}` + (d.tamValueUsd ? ` из ${money(d.tamValueUsd)} всего` : ''))
  {
    const people = knownNum(d.peopleCount, d), spend = knownNum(d.spendTodayUsdMonthly, d), annual = knownNum(d.impliedAnnualSpendUsd, d)
    if (people !== null) facts.push(`людей в сегменте: ${fmtInt(people)}` + (BASIS[d.peopleBasis] ? ` (${BASIS[d.peopleBasis]})` : ''))
    if (spend !== null) facts.push(`бюджет на задачу: $${fmtInt(spend)}/мес — платят сегодня`)
    if (annual !== null) facts.push(`≈ ${money(annual)} в год на весь сегмент (люди × бюджет)`)
  }
  const ver = verificationOf(s.id, g.nodes, E)
  facts.push(`**изучено на ${ver.percent}%** — ворота ${ver.passed} из ${ver.total}` + (ver.blockedAt ? ` — **СТОП: ${ver.blockedReason}**` : ''))
  if (facts.length) L.push(facts.map(f => `- ${f}`).join('\n'), '')
  const calcLines = calcExplainLines(d)
  if (calcLines.length) L.push('## Как посчитаны цифры', '', calcLines.map(l => `- ${l}`).join('\n'), '')
  L.push('## Ворота изучения — что такое 100%', '',
    '*100% = исследованы критерии, фатальные допущения, платёжное поведение и экономика. Отрицательный результат тоже даёт знание; процент изученности не означает прибыльность.*', '')
  for (const gt of ver.gates) L.push(`- ${gt.blocked ? '✕' : gt.done ? '✓' : gt.partial ? '◐' : '—'} **${gt.label}** (${gt.earned}/${gt.weight}) — ${gt.detail}`)
  if (ver.blockers.length) L.push('', '**Риски по результатам исследования:**', '', ...ver.blockers.map(b => `- ${b.reason}`))
  if (ver.next) L.push('', `**Откроет «${ver.next.label}»:** ${ver.next.unlock}`)
  L.push('')
  if (d.context) L.push('## Кто это', '', d.context, '')
  // buying group: segment --involves--> role; the role's own jobs hang on its performs edges
  const INFL = { decides: 'решает', approves: 'утверждает бюджет', vetoes: 'может заблокировать (вето)', champions: 'продвигает изнутри', blocks: 'против — может саботировать', uses: 'пользуется' }
  const roleEdges = E.filter(e => e.from === s.id && e.type === 'involves' && by[e.to])
  if (roleEdges.length) {
    L.push('## Кто решает (роли в покупке)', '')
    for (const re of roleEdges) {
      const role = by[re.to]; const rd = re.data || {}
      const rjobs = outs(role.id, 'performs')
      const personal = rjobs.filter(j => (j.data || {}).personal)
      const business = rjobs.filter(j => !(j.data || {}).personal)
      L.push(`- **${role.label}** — ${INFL[rd.influence] || rd.influence || ''}`)
      if (business.length) L.push(`  - бизнес-работа (оправдывает покупку): ${business.map(j => j.label).join('; ')}`)
      if (personal.length) L.push(`  - личные работы (решают на самом деле): ${personal.map(j => j.label).join('; ')}`)
      if (rd.convincedBy) L.push(`  - чем убедить: ${rd.convincedBy}`)
    }
    if (d.approvalProcess) L.push('', `Как проходит согласование: ${d.approvalProcess}`)
    if (d.budgetCycle) L.push(`Бюджетный цикл: ${d.budgetCycle}`)
    L.push('')
  }
  L.push('## Что пытаются сделать (работы)', '')
  for (const j of jobs) {
    const up = outs(j.id, 'in_order_to')
    L.push(`- **${j.label}**` + (up.length ? ` — ради: ${up[0].label}` : ''))
  }
  L.push('', '## Как судят об успехе (критерии этого сегмента, по приоритету, с полевыми вердиктами)', '')
  const segCrits = critsOf(s.id)
  const addedHere = addedCritIds(s.id)
  for (const [, critList] of segCrits) {
    for (const c of critList) {
      const lvl = (c.data || {}).level || ''
      let line = `- «${c.label}»` + (lvl ? ` — порог: ${lvl}` : '') + ` — *${CV[c.status] || c.status || 'гипотеза'}*`
        + (c.data?.evidenceConflict ? ' — есть противоречащие свидетельства' : '')
        + (c.data?.levelStatus === 'unconfirmed' ? ' — порог не подтверждён' : '')
        + (c.data?.priorityStatus === 'unconfirmed' ? ' — приоритет гипотетический' : '')
        + (addedHere.has(c.id) ? ' — **добавлен острым контекстом этой страны**' : '')
      for (const ev of [...outs(c.id, 'evidenced_by'), ...outs(c.id, 'contradicted_by')]) {
        line += `\n  - цитата: ${ev.label}` + (/^https?:/.test(ev.source || '') ? ` (${ev.source})` : '')
      }
      L.push(line)
    }
  }
  // подсегменты: тот же основной джоб, более острый контекст добавляет критерии
  const subEs = subEdgesOf(s.id)
  if (subEs.length) {
    L.push('', '## Подсегменты', '',
      '*Тот же основной джоб и те же главные критерии; сегмент выигрывается страна за страной.*', '')
    for (const se of subEs) {
      const sub = by[se.from]; const sd = se.data || {}
      const addedLbl = (sd.addedCriteria || []).map(c => by[c.id]).filter(Boolean).map(c => `«${c.label}»`)
      L.push(`- **[${sub.label}](./${sub.id}.md)** — *${ST[sub.status] || sub.status || 'гипотеза'}*`)
      if (sd.sharperContext) L.push(`  - чем контекст острее: ${sd.sharperContext}`)
      if (addedLbl.length) L.push(`  - добавляет критерии: ${addedLbl.join(', ')}`)
      if (sd.triggers && sd.triggers.length) L.push(`  - триггеры: ${sd.triggers.join('; ')}`)
    }
  }
  if (d.qualificationQuestions && d.qualificationQuestions.length) {
    L.push('', '## Как узнать их (вопросы квалификации)', '')
    d.qualificationQuestions.forEach(q => L.push(`- ${q}`))
  }
  const hires = hiresOf(s.id)
  if (hires.length) {
    L.push('', '## Чем решают сейчас', '',
      '*Находки и гипотезы о текущих решениях сегмента; распространённость требует отдельной выборки.*', '')
    for (const h of hires) {
      const nm = isHttp(h.n.source) ? `[${h.n.label}](${h.n.source})` : h.n.label
      const bits = [HIRE_KIND[h.d.kind] || (h.d.kind ? String(h.d.kind) : ''), HIRE_PREV[h.d.prevalence] || ''].filter(Boolean)
      L.push(`- **${nm}**${bits.length ? ` — ${bits.join(', ')}` : ''}`)
      if (h.d.supportStatus && h.d.supportStatus !== 'supported') L.push(`  - найм не подтверждён: ${h.d.supportStatus}`)
      if (h.d.categoryObservation) L.push('  - категория упоминала эту компанию; расходы категории к компании не относятся')
      if (h.d.spendToday) L.push(`  - платят сегодня: ${h.d.spendToday}`)
      if (h.d.whyHired) L.push(`  - за что берут: ${h.d.whyHired}`)
      if (isHttp(h.d.source)) L.push(`  - источник: ${h.d.source}`)
    }
  } else if (d.currentSolutions && d.currentSolutions.length) {
    L.push('', '## Чем решают сейчас', '')
    d.currentSolutions.forEach(cs => L.push(`- ${cs}`))
  }
  const probs = outs(s.id, 'suffers')
  if (probs.length) { L.push('', '## Что у них болит с текущими решениями', ''); probs.forEach(p => L.push(`- ${p.label}`)) }
  const chans = E.filter(e => e.from === s.id && e.type === 'reached_via' && by[e.to])
  if (chans.length) { L.push('', '## Где их искать (каналы)', ''); chans.forEach(e => {
    const channel = by[e.to], details = e.data || {}
    L.push(`- ${channel.label}${details.tactic ? ` — ${details.tactic}` : ''}${details.supportStatus && details.supportStatus !== 'supported' ? ' (гипотеза)' : ''}`)
    if (details.hook) L.push(`  - сообщение для этого сегмента: ${details.hook}`)
  }) }
  // segment-level risky assumptions + which move tests each
  const risks = ins(s.id, 'about').filter(n => n.type === 'assumption')
  if (risks.length) {
    L.push('', '## Риски этого сегмента (что должно оказаться правдой)', '')
    for (const r of risks) {
      const mv = ins(r.id, 'tests')
      L.push(`- «${r.label}»${(r.data || {}).fatal ? ' — **фатально, если неверно**' : ''}` +
        (mv.length ? `\n  - проверяется ходом: ${mv[0].label}` : ''))
    }
  }
  // competitors fighting for this segment's jobs (via competes_for, excluding the product)
  const compSet = new Map()
  for (const j of jobs) for (const c of ins(j.id, 'competes_for')) if (c.type === 'competitor') compSet.set(c.id, c)
  if (compSet.size) {
    L.push('', '## Кто уже конкурирует за эти работы', '')
    for (const c of compSet.values()) {
      const cd = c.data || {}
      L.push(`- ${c.label}${cd.kind === 'direct' ? ' — **прямой**' : ''}${cd.pricing ? ` — ${cd.pricing}` : ''}`)
    }
  }
  const comm = d.communication
  if (comm) {
    L.push('', '## Коммуникация с сегментом', '',
      '*Готовые формулировки, построенные только на подтверждённых критериях и реальных слабостях конкурентов. Черновики — перед публикацией тестировать.*', '')
    const bucket = (title, items) => {
      if (!items || !items.length) return
      L.push(`### ${title}`, '')
      for (const c of items) L.push(`- **${c.title}**${c.readyToUse === false ? ' (гипотеза для теста)' : ''}${c.role ? ` *(для: ${c.role})*` : ''} — «${c.message}»\n  - почему сработает: ${c.why}`)
      L.push('')
    }
    bucket('Донести ценность', comm.value)
    bucket('Снять страхи', comm.fears)
    bucket('Аргументы против конкурентов', comm.competitorCounters)
  }
  if (d.valueIdeas && d.valueIdeas.length) {
    L.push('', '## Что делать — идеи ценности для этого сегмента', '',
      '*Идеи, а не обязательства: брать в работу — через приоритизацию, в MOVES.md.*', '')
    for (const v of d.valueIdeas) {
      L.push(`- **${v.title}** — от боли: ${v.pain}`)
      for (const st of (v.steps || [])) L.push(`  - ${st}`)
      if (v.outcome) L.push(`  - **эффект:** ${v.outcome}`)
      if (v.riskiestPart) L.push(`  - **держится на непроверенном:** ${v.riskiestPart}`)
    }
  }
  L.push('', '*Паспорт генерируется из research-graph.json; правки вносить туда/через инструменты, иначе перезапишутся.*', '')
  fs.writeFileSync(path.join(dir, `${s.id}.md`), L.join('\n'))
  count++
}
console.log(`Wrote ${count} segment passport(s) (md) to ${dir}`)
