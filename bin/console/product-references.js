// Read-only adapter. The graph selects the package; clients cannot select files.
const fs = require('node:fs')
const path = require('node:path')
const {createHash} = require('node:crypto')
const { MIME } = require('./report-assets')

const object = value => value && typeof value === 'object' && !Array.isArray(value)
function validPath(relative, extensions) {
  return typeof relative === 'string' && /^(reports|sources)\//.test(relative) &&
    !/[\\\u0000-\u001f\u007f]/.test(relative) &&
    relative.split('/').every(part => part && part !== '.' && !part.startsWith('.')) &&
    extensions.includes(path.posix.extname(relative).toLowerCase())
}
function packageFile(workspace, relative, extensions = ['.json']) {
  if (!validPath(relative, extensions)) throw Error('Недопустимый путь пакета.')
  const root = fs.realpathSync(workspace)
  const real = fs.realpathSync(path.join(root, relative))
  const canonical = path.relative(root, real).split(path.sep).join('/')
  if (!real.startsWith(root + path.sep) || !validPath(canonical, extensions) || !fs.statSync(real).isFile()) throw Error('Файл вне разрешённого пакета.')
  return real
}
function readJSON(workspace, relative) {
  const file = packageFile(workspace, relative)
  if (fs.statSync(file).size > 20 * 1024 * 1024) throw Error('Файл пакета слишком большой.')
  return JSON.parse(fs.readFileSync(file, 'utf8'))
}
function imageMime(buffer, extension) {
  const detected = buffer.subarray(0, 8).equals(Buffer.from([137,80,78,71,13,10,26,10])) ? 'image/png' :
    buffer[0] === 255 && buffer[1] === 216 && buffer[2] === 255 ? 'image/jpeg' :
    ['GIF87a','GIF89a'].includes(buffer.subarray(0,6).toString()) ? 'image/gif' :
    buffer.subarray(0,4).toString() === 'RIFF' && buffer.subarray(8,12).toString() === 'WEBP' ? 'image/webp' : null
  return detected && detected === MIME[extension] ? detected : null
}
function registered(graph, productId) {
  return (graph.nodes || []).filter(n => n.type === 'artifact' && n.data?.artifactKind === 'product-reference-library' && n.data.productId === productId)
}
const referenceCardHash = card => createHash('sha256').update(JSON.stringify(card)).digest('hex')
function applyReadingViews(workspace,result,relative) {
  if (!relative) return
  try {
    const views=readJSON(workspace,relative)
    if (!object(views)||views.schemaVersion!==1||!Array.isArray(views.entries)||views.entries.length>3000) throw Error()
    const rows=new Map(result.cards.map(row=>[row.card.id,row])),seen=new Set()
    const limits={title:180,summary:800,format:160,example:800,note:800}
    for (const entry of views.entries) {
      const row=rows.get(entry?.cardId)
      if (!object(entry)||!row||seen.has(entry.cardId)||entry.basedOnCardSha256!==referenceCardHash(row.card)||
        Object.entries(limits).some(([key,max])=>entry[key]!=null&&(typeof entry[key]!=='string'||!entry[key].trim()||entry[key].length>max))||
        ['title','summary','format'].some(key=>typeof entry[key]!=='string'||!entry[key].trim())) {
        result.issues.push('Описание одного примера устарело или повреждено. Для него показаны исходные материалы.')
        continue
      }
      seen.add(entry.cardId)
      row.readingView=Object.fromEntries(Object.keys(limits).filter(key=>entry[key]!=null).map(key=>[key,entry[key]]))
      row.readingViewSource=relative
    }
    result.files.push({label:'Описания примеров для просмотра',path:relative})
  } catch {result.issues.push('Понятные описания примеров недоступны. Показаны исходные материалы.')}
}
function applyDesignMaterials(workspace,result,materials) {
  if (materials == null) return
  if (!Array.isArray(materials)||materials.length>24) {result.issues.push('Список материалов нашего продукта повреждён. Референсы остаются доступны.');return}
  const seen=new Set(), groups=[]
  const text=(value,max)=>typeof value==='string'&&value.trim()&&value.length<=max
  for (const group of materials) {
    try {
      if (!object(group)||!text(group.id,120)||seen.has(group.id)||!text(group.title,160)||!text(group.description,600)||
          !['proposed','accepted'].includes(group.decision)||!Array.isArray(group.links)||!group.links.length||group.links.length>12) throw Error()
      const validateLinks=(links,extensions)=>links.map(link=>{if(!object(link)||!text(link.label,180))throw Error();packageFile(workspace,link.path,extensions);return {label:link.label,path:link.path}})
      const links=validateLinks(group.links,['.md','.pdf'])
      const dataFiles=group.dataFiles==null?[]:Array.isArray(group.dataFiles)&&group.dataFiles.length<=12?validateLinks(group.dataFiles,['.json','.jsonl','.md']):null
      if (!dataFiles) throw Error()
      seen.add(group.id);groups.push({id:group.id,title:group.title,description:group.description,decision:group.decision,links})
      for (const link of [...links,...dataFiles]) result.files.push({label:group.title+' · '+link.label,path:link.path})
    } catch {result.issues.push('Один из пакетов нашего продукта недоступен. Остальные материалы можно открыть.')}
  }
  result.library.designMaterials=groups
}
function loadLibrary(workspace, graph, productId, artifactId) {
  const artifacts = registered(graph, productId)
  const libraries = artifacts.map(n => ({id:n.id, title:n.label, manifestFile:n.data.manifestFile}))
  const artifact = artifactId ? artifacts.find(n => n.id === artifactId) : artifacts[0]
  if (!artifact) return {state:'unregistered', libraries, cards:[], issues:[], message:artifactId?'Библиотека не найдена.':'Библиотека пока не зарегистрирована.'}
  const library = {artifactId:artifact.id, title:artifact.label, manifestFile:artifact.data.manifestFile}
  const result = {state:'ready', libraries, library, cards:[], issues:[], files:[]}
  try {
    const manifest = readJSON(workspace, library.manifestFile)
    if (!object(manifest) || manifest.schemaVersion !== 1) return {...result,state:'unsupported',message:'Версия манифеста не поддерживается.'}
    if (manifest.productId !== productId || !Array.isArray(manifest.tracks)) throw Error('Манифест не соответствует продукту или контракту.')
    Object.assign(library, {title:manifest.title || library.title, status:manifest.status, libraryId:manifest.libraryId, tracks:[], gaps:manifest.gaps || []})
    result.files.push({label:'Манифест',path:library.manifestFile})
    const ids = new Set(), trackIds = new Set()
    for (const track of manifest.tracks) {
      const trackTitle = track?.title || track?.key || 'Направление'
      try {
        if (!object(track) || typeof track.key !== 'string' || !track.key.trim() || trackIds.has(track.key)) throw Error('Направление отсутствует или повторяется.')
        trackIds.add(track.key)
        library.tracks.push(track)
        const cards = readJSON(workspace, track.cardsPath), sources = readJSON(workspace, track.sourcesPath)
        if (cards.schemaVersion !== 1 || sources.schemaVersion !== 1) throw Error('Версия карточек или источников не поддерживается.')
        if (!Array.isArray(cards.cards) || !Array.isArray(sources.sources)) throw Error('Неверная структура карточек или источников.')
        const sourceIds = new Set()
        for (const source of sources.sources) {
          if (!object(source) || typeof source.id !== 'string' || sourceIds.has(source.id)) throw Error('Источник отсутствует или повторяется.')
          sourceIds.add(source.id)
        }
        for (const card of cards.cards) {
          if (!object(card) || typeof card.id !== 'string' || !card.id || ids.has(card.id)) {result.issues.push(`${trackTitle}: карточка без ID или с повторным ID пропущена.`);continue}
          if (['steps','claims','media'].some(key => card[key] != null && (!Array.isArray(card[key]) || card[key].some(value => !object(value))))) {
            result.issues.push(`${trackTitle}: у «${card.title || card.id}» повреждены шаги, утверждения или изображения; карточка пропущена.`)
            continue
          }
          ids.add(card.id)
          result.cards.push({card,trackKey:track.key,trackTitle,sources:sources.sources})
          const refs = [...(Array.isArray(card.sourceIds)?card.sourceIds:[]),card.primarySourceId,...(Array.isArray(card.claims)?card.claims:[]).map(c=>c.sourceId),...(Array.isArray(card.media)?card.media:[]).map(m=>m.sourceId)].filter(Boolean)
          if (refs.some(id=>!sourceIds.has(id))) result.issues.push(`${trackTitle}: у «${card.title || card.id}» есть несвязанный источник.`)
        }
        for (const [key,label] of [['cardsPath','Карточки'],['sourcesPath','Источники'],['coveragePath','Покрытие'],['verificationPath','Проверка']]) {
          if (track[key]) {packageFile(workspace,track[key]);result.files.push({label:`${trackTitle} · ${label}`,path:track[key]})}
        }
        if (track.reportPath) {packageFile(workspace,track.reportPath,['.md']);result.files.push({label:`${trackTitle} · Отчёт`,path:track.reportPath})}
      } catch {result.issues.push(`${trackTitle}: пакет недоступен, повреждён или использует неподдерживаемую версию.`)}
    }
    applyReadingViews(workspace,result,manifest.readerPresentationPath)
    applyDesignMaterials(workspace,result,manifest.designMaterials)
    return result
  } catch (error) {
    // Only a missing registered manifest is an expected collection state.
    return {...result, state:error.code === 'ENOENT' ? 'awaiting' : 'error', message:error.code === 'ENOENT'?'Материалы собираются. Манифест ещё не сохранён.':'Не удалось прочитать зарегистрированный манифест. Проверьте формат и доступность пакета.'}
  }
}
function libraryImage(workspace, graph, params) {
  const data = loadLibrary(workspace,graph,params.productId,params.library)
  if (data.state !== 'ready') return null
  const card = data.cards.find(row => row.card.id === params.card)?.card
  const media = (Array.isArray(card?.media)?card.media:[]).find(row => row.id === params.media)
  if (!media) return null
  try {
    const file = packageFile(workspace,media.path,Object.keys(MIME))
    if (fs.statSync(file).size > 30 * 1024 * 1024) return null
    const buffer = fs.readFileSync(file), mime = imageMime(buffer,path.extname(file).toLowerCase())
    return mime ? {buffer,mime} : null
  } catch {return null}
}
module.exports = {loadLibrary,libraryImage,packageFile,imageMime,referenceCardHash}
