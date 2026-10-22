#!/usr/bin/env node
'use strict'
const fs = require('node:fs')
const path = require('node:path')
const crypto = require('node:crypto')
const {validatePresentation}=require('../../../bin/brand-presentation')
const text = x => typeof x === 'string' && x.trim().length > 0
const kinds = ['brief', 'concepts', 'identity-system', 'logobook', 'asset-pack', 'applications']
const roles = ['source', 'concept-board', 'logo', 'palette', 'typography', 'application', 'presentation', 'logobook', 'delivery-index', 'preview']
const visual = new Set(['concept-board', 'logo', 'application', 'presentation', 'palette', 'typography', 'preview'])
const imageExt = new Set(['.svg', '.png', '.jpg', '.jpeg', '.webp', '.pdf', '.pptx'])
const previewSizes = [16, 32, 64]
const hash = f => crypto.createHash('sha256').update(fs.readFileSync(f)).digest('hex')

// WCAG 2.x relative luminance and contrast ratio; #rgb and #rrggbb only.
function hexToRgb(value) {
  const m = /^#?([0-9a-f]{3}|[0-9a-f]{6})$/i.exec(String(value || '').trim())
  if (!m) return null
  const h = m[1].length === 3 ? m[1].split('').map(c => c + c).join('') : m[1]
  return [0, 2, 4].map(i => parseInt(h.slice(i, i + 2), 16))
}
function luminance(rgb) {
  const [r, g, b] = rgb.map(v => { const c = v / 255; return c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4 })
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}
function contrastRatio(fg, bg) {
  const a = hexToRgb(fg), b = hexToRgb(bg)
  if (!a || !b) return null
  const l1 = luminance(a), l2 = luminance(b)
  return Math.round(((Math.max(l1, l2) + 0.05) / (Math.min(l1, l2) + 0.05)) * 100) / 100
}

// Rasterise an SVG logo at small sizes with the repository's Playwright Chromium, if available.
async function renderPreviews(svgFile, targets) {
  let playwright
  try { playwright = require('playwright') } catch { return { rendered: [], skipped: 'playwright is not installed next to this skill; small logo previews were not produced' } }
  const svg = fs.readFileSync(svgFile)
  const src = `data:image/svg+xml;base64,${svg.toString('base64')}`
  let browser
  try { browser = await playwright.chromium.launch() } catch (e) { return { rendered: [], skipped: `chromium unavailable (${e.message.split('\n')[0]}); small logo previews were not produced` } }
  const rendered = []
  try {
    for (const { size, file } of targets) {
      const page = await browser.newPage({ viewport: { width: size, height: size }, deviceScaleFactor: 1 })
      await page.setContent(`<html><body style="margin:0;background:transparent"><img style="display:block;width:${size}px;height:${size}px;object-fit:contain" src="${src}"></body></html>`)
      const png = await page.screenshot({ omitBackground: true, type: 'png' })
      fs.mkdirSync(path.dirname(file), { recursive: true })
      fs.writeFileSync(file, png)
      await page.close()
      rendered.push(file)
    }
  } finally { await browser.close() }
  return { rendered, skipped: null }
}

function validateSync(workspace, relative, options = {}) {
  const root = fs.realpathSync(workspace), errors = [], warnings = []
  function local(value, label) {
    if (!text(value) || path.isAbsolute(value) || /[\\:#?]/.test(value) || value.split('/').some(p => !p || p === '.' || p === '..')) {
      errors.push(`${label}: expected a workspace-relative file path`); return null
    }
    const file = path.join(root, value)
    if (!fs.existsSync(file) || !fs.statSync(file).isFile()) { errors.push(`${label}: missing file ${value}`); return null }
    const resolved = fs.realpathSync(file)
    if (!resolved.startsWith(root + path.sep)) { errors.push(`${label}: file escapes workspace`); return null }
    return file
  }
  const mf = local(relative, 'manifest')
  if (!mf) return { ok: false, errors, warnings }
  let m
  try { m = JSON.parse(fs.readFileSync(mf, 'utf8')) } catch { return { ok: false, errors: ['Invalid manifest JSON'], warnings } }
  if (!m || typeof m !== 'object' || Array.isArray(m)) return { ok: false, errors: ['Manifest must be an object'], warnings }
  if (![1, 2, 3].includes(m.schemaVersion)) errors.push('Unsupported schemaVersion (1, 2 or 3)')
  // Schema 2 turns the 2026-09 additions into errors; schema 1 keeps earlier releases valid and only warns.
  const strict = m.schemaVersion >= 2
  const gap = (message) => (strict ? errors : warnings).push(message)
  if (!text(m.product?.name) || !(m.product?.id === null || text(m.product?.id))) errors.push('Product name and id (or null) required')
  if (!Number.isInteger(m.version) || m.version < 1) errors.push('Positive integer version required')
  if (!['logo', 'brand', 'system'].includes(m.scope)) errors.push('Unknown scope')
  if (!['brief', 'directions', 'system', 'handoff'].includes(m.stage)) errors.push('Unknown stage')
  if (!['draft', 'ready-for-review'].includes(m.readiness)) errors.push('Unknown readiness')
  if (!['proposed', 'accepted'].includes(m.decision)) errors.push('Unknown decision')
  if (m.decision === 'accepted' && !text(m.decisionSource)) errors.push('Acceptance needs decisionSource')
  const ready = m.readiness === 'ready-for-review'
  if (ready && m.waitingFor != null) errors.push('Pending input keeps the result draft')
  for (const name of ['requestedDeliverables', 'sources', 'assumptions', 'rules', 'directions', 'files', 'deliverables', 'qa']) {
    if (!Array.isArray(m[name])) { errors.push(`${name} must be an array`); m[name] = [] }
  }
  if (!m.requestedDeliverables.length || m.requestedDeliverables.some(k => !kinds.includes(k)) || new Set(m.requestedDeliverables).size !== m.requestedDeliverables.length) errors.push('Unique known requestedDeliverables required')
  function byId(rows, label) {
    const by = new Map()
    for (const r of rows) {
      if (!r || !text(r.id) || by.has(r.id)) errors.push(`${label}: unique nonempty IDs required`)
      else by.set(r.id, r)
    }
    return by
  }
  const files = byId(m.files, 'files'), sources = byId(m.sources, 'sources'), directions = byId(m.directions, 'directions')
  byId(m.rules, 'rules'); byId(m.assumptions, 'assumptions')
  if (m.selectedDirection != null && !directions.has(m.selectedDirection)) errors.push('selectedDirection does not exist')
  if (m.selectedDirection != null && !text(m.selectionSource)) errors.push('Selected direction needs selectionSource')
  if (ready && ['system', 'handoff'].includes(m.stage) && !m.selectedDirection) errors.push('System/handoff needs a selected direction')
  for (const s of m.sources.filter(Boolean)) {
    if (!['user-requirement', 'product-evidence', 'style-reference', 'existing-brand-asset', 'method'].includes(s.kind) || !text(s.locator) || typeof s.viewed !== 'boolean') errors.push(`Invalid source ${s.id}`)
  }
  // A method source must point at a page or principle, not at the index of the whole library.
  const pageLevel = s => s?.kind === 'method' && /(pages\/\d{4}\.txt|#lev\d+|#page=\d+|\bс\.\s*\d|\bp{1,2}\.\s*\d|принцип\w*\s*\d|principle\s*\d|\bpp?\b\.?\s*\d)/i.test(`${s.locator} ${s.note || ''}`)
  for (const a of m.assumptions.filter(Boolean)) {
    if (!text(a.statement) || !text(a.basis) || typeof a.fatal !== 'boolean' || !['open', 'checked', 'withdrawn'].includes(a.status)) errors.push(`Invalid assumption ${a.id}`)
    if (a.fatal === true && !text(a.check)) gap(`Fatal assumption ${a.id} has no check protocol`)
    if (a.check !== undefined && a.check !== null && typeof a.check !== 'string') errors.push(`Assumption ${a.id}: check must be a string`)
  }
  const contrast = []
  for (const r of m.rules.filter(Boolean)) {
    if (!text(r.topic) || !text(r.value) || !text(r.rationale) || !['required', 'preferred', 'candidate'].includes(r.strength) || !Array.isArray(r.sourceIds) || !r.sourceIds.length || r.sourceIds.some(id => !sources.has(id))) errors.push(`Rule ${r.id} needs meaning and real source IDs`)
    if (r.strength === 'required') {
      const demo = [...(Array.isArray(r.demoFileIds) ? r.demoFileIds : []), ...(Array.isArray(r.fileIds) ? r.fileIds : [])]
      if (!demo.length) gap(`Required rule ${r.id} names no file where it is visible (demoFileIds)`)
      else if (demo.some(id => !files.has(id))) errors.push(`Rule ${r.id}: demoFileIds must reference existing files`)
      const methods = r.sourceIds.map(id => sources.get(id)).filter(s => s?.kind === 'method')
      if (methods.length && !methods.some(pageLevel)) gap(`Required rule ${r.id} relies on a method source without a page or principle locator`)
    }
    if (r.pairs !== undefined) {
      if (!Array.isArray(r.pairs)) errors.push(`Rule ${r.id}: pairs must be an array`)
      else for (const pair of r.pairs) {
        const ratio = pair && contrastRatio(pair.fg, pair.bg)
        if (ratio == null) { errors.push(`Rule ${r.id}: pair needs hex fg and bg`); continue }
        const minRatio = typeof pair.minRatio === 'number' ? pair.minRatio : null
        const row = { ruleId: r.id, role: pair.role || null, fg: pair.fg, bg: pair.bg, ratio, minRatio, meetsMin: minRatio == null ? null : ratio >= minRatio }
        contrast.push(row)
        if (row.meetsMin === false) warnings.push(`Rule ${r.id}: ${pair.fg} on ${pair.bg} is ${ratio}:1, below its own ${minRatio}:1 (decorative use only unless the rule says otherwise)`)
      }
    } else if (r.topic === 'color' && r.strength !== 'candidate') {
      const hexes = [...String(r.value).matchAll(/#[0-9a-f]{6}\b/gi)].map(x => x[0])
      if (hexes.length >= 2) warnings.push(`Rule ${r.id} lists colours but no pairs [{fg,bg,role,minRatio}]; contrast was not computed`)
    }
  }
  const paths = new Set()
  for (const f of files.values()) {
    if (!roles.includes(f.role)) errors.push(`Unknown role ${f.role}`)
    if (paths.has(f.path)) errors.push(`Duplicate file path ${f.path}`)
    paths.add(f.path)
    const p = local(f.path, `file ${f.id}`)
    if (!/^[a-f0-9]{64}$/.test(f.sha256 || '') || (p && hash(p) !== f.sha256)) errors.push(`File hash mismatch: ${f.id}`)
    if (visual.has(f.role) && !imageExt.has(path.extname(typeof f.path === 'string' ? f.path : '').toLowerCase())) errors.push(`Visual ${f.id} must be an actual visual file`)
  }
  function refs(ids, label) {
    if (!Array.isArray(ids) || !ids.length || ids.some(id => !files.has(id))) errors.push(`${label}: existing fileIds required`)
    return Array.isArray(ids) ? ids.map(id => files.get(id)).filter(Boolean) : []
  }
  for (const d of directions.values()) {
    if (!text(d.label) || !text(d.rationale) || !text(d.tradeoffs)) errors.push(`Direction ${d.id} needs rationale and tradeoffs`)
    if (ready || d.fileIds?.length) {
      const ff = refs(d.fileIds, `direction ${d.id}`)
      if (!ff.some(f => ['concept-board', 'logo', 'application', 'presentation'].includes(f.role))) errors.push(`Direction ${d.id} needs a visual`)
    }
  }
  const delivered = new Set()
  for (const d of m.deliverables.filter(Boolean)) {
    if (!kinds.includes(d.kind) || delivered.has(d.kind)) errors.push('Unique known deliverable kinds required')
    delivered.add(d.kind)
    const ff = refs(d.fileIds, `deliverable ${d.kind}`)
    if (ff.length && ff.every(f => f.role === 'source')) errors.push(`Deliverable ${d.kind} contains only input sources`)
    const requiredRole = { concepts: ['concept-board', 'presentation'], logobook: ['logobook'], applications: ['application'], 'asset-pack': ['logo', 'application', 'palette', 'typography'] }[d.kind]
    if (requiredRole && !ff.some(f => requiredRole.includes(f.role))) errors.push(`Deliverable ${d.kind} lacks its output files`)
  }
  if (ready) for (const k of m.requestedDeliverables) if (!delivered.has(k)) errors.push(`Missing requested deliverable: ${k}`)
  if(m.presentation)errors.push(...validatePresentation(m.presentation,m))
  else if(m.schemaVersion===3&&ready)errors.push('A ready schema-3 identity needs a saved presentation')
  const inspected = new Set()
  for (const q of m.qa.filter(Boolean)) {
    const f = files.get(q.fileId)
    if (!f || q.sha256 !== f.sha256) errors.push(`QA refers to a missing/changed file: ${q.fileId}`)
    if (typeof q.viewed !== 'boolean' || !text(q.viewSize) || !text(q.result) || !Array.isArray(q.issues)) { errors.push(`Incomplete QA for ${q.fileId}`); continue }
    if (q.renderPath) local(q.renderPath, 'QA render')
    if (q.viewed) inspected.add(q.fileId)
    for (const issue of q.issues) {
      if (!issue || !['blocking', 'minor'].includes(issue.severity) || !text(issue.detail)) errors.push('Malformed QA issue')
      else if (ready && issue.severity === 'blocking') errors.push(`Blocking QA issue: ${q.fileId}`)
    }
  }
  if (ready) for (const f of files.values()) if ((visual.has(f.role) || f.role === 'logobook') && !inspected.has(f.id)) errors.push(`No visual/document inspection: ${f.id}`)

  // Small-size previews of every SVG logo: produced once next to the manifest by validate(), then registered and reviewed like any file.
  const previews = { produced: options.produced || [], expected: [], missing: [], skipped: options.skipped || null }
  const runDir = path.dirname(mf)
  const svgLogos = [...files.values()].filter(f => f.role === 'logo' && typeof f.path === 'string' && f.path.toLowerCase().endsWith('.svg') && fs.existsSync(path.join(root, f.path)))
  const byPath = new Map([...files.values()].map(f => [f.path, f]))
  for (const logo of svgLogos) {
    for (const size of previewSizes) {
      const rel = path.relative(root, path.join(runDir, 'previews', 'validator', `${logo.id}-${size}.png`)).split(path.sep).join('/')
      previews.expected.push({ logoId: logo.id, size, path: rel })
      const file = path.join(root, rel)
      if (!fs.existsSync(file)) previews.missing.push({ logoId: logo.id, size, path: rel, file })
      else {
        const entry = byPath.get(rel)
        if (!entry) gap(`Preview ${rel} exists but is not registered in files`)
        else if (!inspected.has(entry.id)) gap(`Preview ${rel} has no viewed QA record`)
      }
    }
  }
  if (previews.missing.length && !strict) {
    // Released schema-1 versions are immutable: report, never write into their folders.
    warnings.push(`${previews.missing.length} small logo preview(s) not produced for a schema-1 manifest; new versions use schemaVersion 3`)
  } else if (previews.missing.length) {
    if (previews.skipped) warnings.push(previews.skipped)
    for (const t of previews.missing) gap(previews.produced.includes(t.path)
      ? `New preview ${t.path}: register it in files with its SHA-256 and record viewed QA`
      : previews.skipped ? `Preview ${t.path} could not be produced` : `Missing small logo preview ${t.path} (run validate.cjs without --no-render to produce it)`)
  }

  if (m.basedOn != null) {
    const previous = local(m.basedOn?.manifestFile, 'basedOn')
    if (previous) {
      try {
        const old = JSON.parse(fs.readFileSync(previous, 'utf8'))
        if (fs.realpathSync(previous) === fs.realpathSync(mf) || !(old.version < m.version) || old.product?.id !== m.product?.id || old.product?.name !== m.product?.name) errors.push('basedOn must be an earlier version of this product')
      } catch { errors.push('Invalid basedOn JSON') }
    }
  }
  const open = m.assumptions.filter(a => a?.status === 'open')
  return {
    ok: !errors.length, errors, warnings, schemaVersion: m.schemaVersion, files: files.size, inspected: inspected.size,
    unvalidatedAssumptions: open.length, fatalAssumptions: open.filter(a => a.fatal).length,
    fatalWithoutCheck: open.filter(a => a.fatal && !text(a.check)).length,
    contrast, previews,
    limitation: 'Checks file integrity, recorded QA, small-size logo rasters, declared colour-pair contrast and rule/assumption completeness — not visual quality, user acceptance, publication or market validation.'
  }
}
if (require.main === module) {
  (async () => {
    const args = process.argv.slice(2)
    const render = !args.includes('--no-render')
    const positional = args.filter(a => !a.startsWith('--'))
    if (positional.length !== 2) throw new Error('Usage: node validate.cjs <workspace> <relative-identity.json> [--no-render]')
    const result = await validate(positional[0], positional[1], { render })
    console.log(JSON.stringify(result, null, 2)); process.exitCode = result.ok ? 0 : 1
  })().catch(e => { console.error(e.message); process.exitCode = 1 })
}
// Full validation: produce missing small previews for schema-2/3 manifests, then validate again.
async function validate(workspace, relative, options = {}) {
  const first = validateSync(workspace, relative, options)
  if (options.render === false || ![2,3].includes(first.schemaVersion) || !first.previews?.missing?.length) return first
  const root = fs.realpathSync(workspace)
  const manifest = JSON.parse(fs.readFileSync(path.join(root, relative), 'utf8'))
  const files = new Map((manifest.files || []).map(f => [f.id, f]))
  const produced = []
  let skipped = null
  const groups = new Map()
  for (const t of first.previews.missing) { if (!groups.has(t.logoId)) groups.set(t.logoId, []); groups.get(t.logoId).push({ size: t.size, file: t.file }) }
  for (const [logoId, targets] of groups) {
    const result = await renderPreviews(path.join(root, files.get(logoId).path), targets)
    produced.push(...result.rendered.map(f => path.relative(root, f).split(path.sep).join('/')))
    if (result.skipped) { skipped = result.skipped; break }
  }
  return validateSync(workspace, relative, { ...options, produced, skipped })
}
module.exports = { validate, validateSync, contrastRatio }
