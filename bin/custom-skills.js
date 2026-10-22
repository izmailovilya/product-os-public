const fs = require('node:fs')
const path = require('node:path')
const { createHash, randomUUID } = require('node:crypto')

const PUBLIC_REPO = 'izmailovilya/product-os-public'
const hash = value => createHash('sha256').update(value).digest('hex')
const exists = file => fs.lstatSync(file, { throwIfNoEntry: false })
function nameOf(name) {
  if (typeof name !== 'string' || name.length > 64 || !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(name) || name === 'product-os-tools') throw new Error('Имя навыка: до 64 строчных латинских букв, цифр и одиночных дефисов.')
  return name
}
function contained(root, file) {
  if (file !== root && !file.startsWith(root + path.sep)) throw new Error('Путь вне рабочего места.')
  for (let current = file;; current = path.dirname(current)) {
    if (exists(current)?.isSymbolicLink()) throw new Error('Символические ссылки не поддерживаются: ' + current)
    if (current === root) break
  }
  return file
}
function readSkill(directory) {
  directory = path.resolve(directory)
  if (!exists(directory)?.isDirectory() || exists(directory).isSymbolicLink()) throw new Error('Нужна папка навыка без символических ссылок.')
  const files = []
  function visit(dir, prefix = '') {
    for (const entry of fs.readdirSync(dir, { withFileTypes: true }).sort((a, b) => a.name.localeCompare(b.name, 'en'))) {
      const relative = prefix + entry.name, file = path.join(dir, entry.name)
      if (entry.isSymbolicLink() || (!entry.isDirectory() && !entry.isFile())) throw new Error('Только обычные файлы навыка: ' + relative)
      if (entry.name.startsWith('.') || /(?:^|\.)(?:pem|key|p12|pfx)$/i.test(entry.name)) throw new Error('Уберите скрытые файлы и ключи из навыка: ' + relative)
      if (!prefix && !['SKILL.md', 'LICENSE', 'THIRD-PARTY-NOTICES.md', 'AUTHOR.md', 'scripts', 'references', 'assets', 'examples', 'agents'].includes(entry.name)) throw new Error('Посторонний файл в навыке: ' + relative)
      if (entry.isDirectory()) visit(file, relative + '/')
      else files.push({ path: relative, bytes: fs.readFileSync(file), mode: fs.statSync(file).mode & 0o111 ? 0o755 : 0o644 })
    }
  }
  visit(directory)
  const text = files.find(file => file.path === 'SKILL.md')?.bytes.toString('utf8') || ''
  const frontmatter = text.match(/^---\r?\n([\s\S]*?)\r?\n---(?:\r?\n|$)/)?.[1]
  const name = frontmatter?.match(/^name:\s*['"]?([a-z0-9-]+)['"]?\s*$/m)?.[1]
  if (!name || !/^description:\s*\S+/m.test(frontmatter)) throw new Error('SKILL.md должен содержать frontmatter с name и description.')
  nameOf(name)
  if (path.basename(directory) !== name) throw new Error('Имя папки должно совпадать с name в SKILL.md.')
  const revision = hash(JSON.stringify(files.map(file => [file.path, hash(file.bytes), file.mode])))
  return { name, directory, revision, files }
}
function context(workspace) {
  const root = fs.realpathSync(path.resolve(workspace))
  const stateFile = contained(root, path.join(root, '.product-os', 'custom-skills.json'))
  const state = exists(stateFile) ? JSON.parse(fs.readFileSync(stateFile, 'utf8')) : { version: 1, skills: {} }
  if (state.version !== 1 || !state.skills || typeof state.skills !== 'object' || Array.isArray(state.skills)) throw new Error('Некорректный реестр пользовательских навыков.')
  const canonical = name => contained(root, path.join(root, '.product-os', 'custom-skills', nameOf(name)))
  const save = () => {
    fs.mkdirSync(path.dirname(stateFile), { recursive: true })
    const temp = stateFile + '.' + randomUUID() + '.tmp'
    fs.writeFileSync(temp, JSON.stringify(state, null, 2) + '\n')
    fs.renameSync(temp, stateFile)
  }
  return { root, state, canonical, save }
}
function destinations(ctx, name, agent) {
  if (!['claude', 'codex', 'both'].includes(agent)) throw new Error('--agent both|claude|codex')
  return (agent === 'both' ? ['claude', 'codex'] : [agent]).map(agent => ({ agent, directory: contained(ctx.root, path.join(ctx.root, agent === 'codex' ? '.agents' : '.claude', 'skills', name)) }))
}
function bundled(name) {
  return exists(path.join(__dirname, '..', 'skills', name, 'SKILL.md')) || name === 'product-research'
}
function writeFiles(directory, files) {
  fs.mkdirSync(directory, { recursive: true })
  for (const file of files) {
    const destination = path.join(directory, file.path)
    fs.mkdirSync(path.dirname(destination), { recursive: true })
    fs.writeFileSync(destination, file.bytes)
    fs.chmodSync(destination, file.mode)
  }
}
function add(workspace, source, { agent = 'both' } = {}) {
  const ctx = context(workspace), skill = readSkill(source), prior = Object.hasOwn(ctx.state.skills, skill.name) ? ctx.state.skills[skill.name] : undefined
  if (bundled(skill.name)) throw new Error('Это имя поставляемого навыка. Выберите отдельное имя для своего расширения.')
  const canonical = ctx.canonical(skill.name), sameSource = path.resolve(source) === canonical
  if (exists(canonical) && !sameSource && (!prior || readSkill(canonical).revision !== prior.revision)) throw new Error('Сохраните изменения своего навыка через skills sync перед заменой.')
  const targets = destinations(ctx, skill.name, agent)
  // Check every destination before changing either agent's files.
  for (const target of targets) if (exists(target.directory)) {
    const oldRevision = prior?.installations?.[target.agent]
    if (!oldRevision || readSkill(target.directory).revision !== oldRevision) throw new Error('У агента уже есть отдельный или изменённый навык: ' + target.directory + '. Сохраните его изменения отдельно.')
  }
  if (!sameSource) {
    if (exists(canonical)) fs.rmSync(canonical, { recursive: true })
    writeFiles(canonical, skill.files)
  }
  for (const target of targets) {
    if (exists(target.directory)) fs.rmSync(target.directory, { recursive: true })
    writeFiles(target.directory, skill.files)
  }
  ctx.state.skills[skill.name] = { ...prior, revision: skill.revision, installations: { ...prior?.installations, ...Object.fromEntries(targets.map(target => [target.agent, skill.revision])) } }
  ctx.save()
  return { name: skill.name, revision: skill.revision, source: canonical, agents: targets.map(target => target.agent), verified: prior?.verification?.revision === skill.revision }
}
function current(workspace, name) {
  const ctx = context(workspace), record = Object.hasOwn(ctx.state.skills, nameOf(name)) ? ctx.state.skills[name] : undefined
  if (!record) throw new Error('Навык не зарегистрирован. Сначала skills add.')
  const skill = readSkill(ctx.canonical(name))
  if (skill.revision !== record.revision) throw new Error('Навык изменён. Сначала skills sync, затем повторите проверку.')
  return { ctx, record, skill }
}
function verify(workspace, name, evidence) {
  if (!evidence?.trim()) throw new Error('Укажите --evidence: какой пример проверен и что наблюдали. Команда сама не запускает навык.')
  const { ctx, record, skill } = current(workspace, name)
  record.verification = { revision: skill.revision, evidence, date: new Date().toISOString() }
  ctx.save()
  return { name, verification: record.verification }
}
function offer(workspace, name, { decline = false } = {}) {
  const { ctx, record, skill } = current(workspace, name)
  const eligible = record.verification?.revision === skill.revision
  const shouldAsk = eligible && record.offeredRevision !== skill.revision && record.declinedRevision !== skill.revision && record.preparedRevision !== skill.revision
  if (decline) record.declinedRevision = skill.revision
  else if (shouldAsk) record.offeredRevision = skill.revision
  ctx.save()
  return { name, shouldAsk: !decline && shouldAsk, verified: eligible, prompt: !decline && shouldAsk ? 'Этот навык может пригодиться другим пользователям Product OS. Подготовить pull request, чтобы поделиться им? Авторство сохраним за вами.' : null }
}
function prepare(workspace, name, { author, files = [] } = {}) {
  if (!author?.trim() || /[\r\n]/.test(author)) throw new Error('Укажите --author: имя или GitHub username автора.')
  const { ctx, record, skill } = current(workspace, name)
  if (record.verification?.revision !== skill.revision) throw new Error('Сначала проверьте навык на примере и запишите результат через skills verify.')
  const selected = new Set(['SKILL.md', ...files])
  for (const file of selected) if (!skill.files.some(item => item.path === file)) throw new Error('Файл не входит в навык: ' + file)
  const included = skill.files.filter(file => selected.has(file.path))
  const output = contained(ctx.root, path.join(ctx.root, '.product-os', 'contributions', name, randomUUID()))
  const skillPath = path.join(output, 'community-skills', name)
  writeFiles(skillPath, included)
  // Attribution and the example are explicit reviewable text, never inferred from product data.
  const attribution = `Автор: ${author}\n\nНавык предложен для Product OS Public.\n`
  if (!selected.has('AUTHOR.md')) fs.writeFileSync(path.join(skillPath, 'AUTHOR.md'), attribution)
  const body = `Добавлен пользовательский навык \`${name}\`.\n\nАвтор: ${author}\n\nПроверка автором:\n${record.verification.evidence}\n\nПеред отправкой автор проверяет состав файлов, права на материалы и согласие на MIT. Проверка команды Product OS ещё не выполнена.\n`
  fs.writeFileSync(path.join(output, 'PR.md'), body)
  const review = { repository: PUBLIC_REPO, name, author, sourceRevision: skill.revision, files: fs.readdirSync(skillPath, { recursive: true }).filter(file => fs.statSync(path.join(skillPath, file)).isFile()).sort(), omitted: skill.files.filter(file => !selected.has(file.path)).map(file => file.path), submitted: false }
  fs.writeFileSync(path.join(output, 'review.json'), JSON.stringify(review, null, 2) + '\n')
  record.preparedRevision = skill.revision
  ctx.save()
  return { ...review, directory: output, bodyFile: path.join(output, 'PR.md'), next: 'Покажите все файлы и текст PR владельцу. После разрешения на публикацию создайте fork/ветку и PR. Без разрешения пакет остаётся локальным.' }
}
function list(workspace) {
  const ctx = context(workspace)
  return Object.entries(ctx.state.skills).map(([name, record]) => ({ name, source: ctx.canonical(name), agents: Object.keys(record.installations || {}), changed: readSkill(ctx.canonical(name)).revision !== record.revision, verified: record.verification?.revision === readSkill(ctx.canonical(name)).revision }))
}
function main(args) {
  const [action, workspace, value, ...rest] = args
  const flags = {}, files = []
  for (let i = 0; i < rest.length; i += 2) {
    if (!['--agent', '--author', '--evidence', '--file'].includes(rest[i]) || !rest[i + 1] || rest[i + 1].startsWith('--')) throw new Error('Неизвестный или незаполненный параметр навыка: ' + rest[i])
    if (rest[i] === '--file') files.push(rest[i + 1]); else flags[rest[i].slice(2)] = rest[i + 1]
  }
  if (!workspace) throw new Error('skills add|sync|list|verify|offer|decline|prepare <workspace> [skill] [options]')
  let result
  if (action === 'add') { if (!value) throw new Error('skills add <workspace> <skill-directory>'); result = add(workspace, value, flags) }
  else if (action === 'sync') result = add(workspace, context(workspace).canonical(value), flags)
  else if (action === 'list') { if (value) throw new Error('skills list <workspace>'); result = list(workspace) }
  else if (action === 'verify') result = verify(workspace, value, flags.evidence)
  else if (action === 'offer' || action === 'decline') result = offer(workspace, value, { decline: action === 'decline' })
  else if (action === 'prepare') result = prepare(workspace, value, { ...flags, files })
  else throw new Error('Неизвестная команда навыков: ' + action)
  console.log(JSON.stringify(result, null, 2))
  return result
}
module.exports = { readSkill, add, verify, offer, prepare, list, main }
