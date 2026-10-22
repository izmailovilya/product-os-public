// Public's reading paths. Only fictional data, no agent integrations.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const {createHash} = require('node:crypto')
const {chromium} = require('@playwright/test')
const {init,importSource} = require('../bin/public-workspace')
const {GraphTransaction} = require('../bin/graph/writer')
const {createConsoleServer,listen} = require('../bin/console/server')
const hash = file => createHash('sha256').update(fs.readFileSync(file)).digest('hex')

async function readReferenceImages(page) {
  const scroll=await page.evaluate(()=>({x:scrollX,y:scrollY}))
  for(const img of await page.locator('[data-reference-raster]').all()) {
    await img.scrollIntoViewIfNeeded()
    await page.waitForFunction(el=>el.complete&&el.naturalWidth>0,await img.elementHandle())
  }
  await page.evaluate(({x,y})=>window.scrollTo(x,y),scroll)
}

function resultFixtures(dir, source) {
  const report='reports/consultant-discovery.md'
  fs.writeFileSync(path.join(dir,report),`---\ntitle: Как консультанты находят решение\nskill: product-deep-research\nnodeId: seg-consultants\noutcome: partial\ndate: 2026-10-21\nsummary: Найдены примеры выбора календаря. Готовность платить пока не проверена.\n---\n# Как консультанты находят решение\n\nНайдены примеры выбора календаря. Готовность платить пока не проверена.\n\n## Область и ограничения\nИзучен только поиск решения; удержание не исследовано.\n\n## Источник\n[Учебная заметка](../${source})\n`)
  const map=JSON.parse(JSON.stringify(require('./fixtures/strategic-job-example.json')))
  map.scope={edition:'full'}
  map.editions={full:'Текущее предложение учебного сервиса',public:'Бесплатное предложение учебного сервиса'}
  map.contexts[0].segmentId='seg-consultants'
  map.contexts[1].segmentId='missing-segment'
  fs.writeFileSync(path.join(dir,'reports/strategic-jobs.json'),JSON.stringify(map))
  return report
}
async function offeringScopes(browser,url,dir,output) {
  const file=path.join(dir,'reports/strategic-jobs.json'),original=fs.readFileSync(file),graph=hash(path.join(dir,'research-graph.json')),cases=path.join(dir,'reports/offering-cases')
  fs.mkdirSync(cases,{recursive:true})
  try {
    for(const edition of ['legacy','full','public']) {
      const map=JSON.parse(original)
      if(edition==='legacy')delete map.scope;else map.scope.edition=edition
      fs.writeFileSync(file,JSON.stringify(map));fs.writeFileSync(path.join(cases,edition+'.json'),JSON.stringify(map))
      const before=hash(file),page=await browser.newPage({viewport:{width:1440,height:1000}});page.setDefaultTimeout(15000)
      try {
        await page.goto(url+'/#jobs');await page.getByRole('button',{name:'Список',exact:true}).click()
        const selected=edition==='public'?'public':'full',other=selected==='public'?'full':'public',expected=map.jobs.j1[selected]
        await page.getByText(expected.contribution,{exact:true}).first().waitFor()
        if(expected.state==='ready')await page.getByText('Доступно в продукте',{exact:true}).first().waitFor()
        assert.equal(await page.getByText(map.jobs.j1[other].contribution,{exact:true}).count(),0)
        await page.screenshot({path:path.join(output,`map-scope-${edition}-list.png`),fullPage:true})
        await page.getByRole('button',{name:'Схема',exact:true}).click()
        await page.locator(`[data-job=j1][data-state=${expected.state}]`).first().waitFor()
        const response=await fetch(url+'/api/strategic-jobs?productId=product'),value=await response.json()
        assert.equal(value.state,'ready');assert.deepEqual(value.map.jobs.j1.full,map.jobs.j1.full);assert.deepEqual(value.map.jobs.j1.public,map.jobs.j1.public)
        fs.writeFileSync(path.join(cases,edition+'-response.json'),JSON.stringify(value))
        fs.writeFileSync(path.join(output,'map-scope-'+edition+'-response.json'),JSON.stringify(value))
        // An explicit old caller option is only a fallback: saved scope wins.
        await page.evaluate(({data,edition})=>{document.querySelector('#publicMapReading').innerHTML=window.JobFlow.strategicMarkup('product',data,{edition,profileLinksOnly:true})},{data:value,edition:edition==='legacy'?'full':other})
        await page.locator(`[data-job=j1][data-state=${expected.state}]`).first().waitFor()
        assert.equal(await page.locator(`[data-job=j1][data-state=${expected.state}]`).count(),2)
        await page.screenshot({path:path.join(output,`map-scope-${edition}-canvas.png`),fullPage:true})
        assert.equal(hash(file),before,'Reading must not rewrite map offering slots or scope')
        assert.equal(hash(path.join(dir,'research-graph.json')),graph)
      } finally {await page.close()}
    }
  } finally {fs.writeFileSync(file,original)}
}
async function libraryFixtures(dir,url) {
  const write=(file,value)=>{const target=path.join(dir,file);fs.mkdirSync(path.dirname(target),{recursive:true});fs.writeFileSync(target,typeof value==='string'?value:JSON.stringify(value))}
  const identity=(await import('./fixtures/identity-example.mjs')).identityExample()
  const profile=identity.profile;profile.product.id='product';profile.presentation=identity.presentation
  const image=fs.readFileSync(path.resolve(__dirname,'fixtures/identity-typography-example.png'))
  profile.files=profile.files.map(({previewURL,available,preview,...file})=>({...file,sha256:createHash('sha256').update(image).digest('hex')}))
  write('reports/identity-fixture/identity.json',profile)
  fs.writeFileSync(path.join(dir,'reports/identity-fixture/type.png'),image)
  write(profile.decisionSource,'# Учебный выбор\n\nЭто вымышленное решение для проверки статуса принятия.\n')
  const proposed={...profile,version:2,decision:'proposed'};delete proposed.decisionSource
  write('reports/identity-fixture/proposed.json',proposed)
  const reference=(await import('./fixtures/reference-example.mjs')).referenceExample({singleTrack:true})
  const cards=[reference.cards[0],reference.cards.at(-1)].map(row=>structuredClone(row.card))
  cards.forEach(card=>card.media.forEach(media=>delete media.previewURL))
  const sources=reference.cards[0].sources.map(source=>({...source,url:url+'/source?path=reports%2Freference-fixture%2Foriginal.md'}))
  write(reference.library.manifestFile,{schemaVersion:1,productId:'product',libraryId:'fiction',title:'Учебная библиотека',status:'ready-for-review-partial',tracks:[{key:'path',title:'Путь и последовательность',cardsPath:'sources/reference-fixture/cards.json',sourcesPath:'sources/reference-fixture/sources.json'}],gaps:['Данные вымышлены; эффект на клиента не проверен.']})
  write('sources/reference-fixture/cards.json',{schemaVersion:1,cards})
  write('sources/reference-fixture/sources.json',{schemaVersion:1,sources})
  write('reports/reference-fixture/original.md','# Учебный исходный каталог\n\nСинтетические данные только для проверки источников и возврата.\n')
  fs.copyFileSync(path.resolve(__dirname,'fixtures/reference-example.png'),path.join(dir,'sources/reference-fixture/image.png'))
  return [
    ['fiction-identity','Учебная айдентика',{kind:'visual-profile',artifactKind:'brand-identity',productId:'product',version:1,decision:'accepted',decisionSource:profile.decisionSource,profileFile:'reports/identity-fixture/identity.json'}],
    ['fiction-proposal','Предложение айдентики',{kind:'visual-profile',artifactKind:'brand-identity',productId:'product',version:2,decision:'proposed',profileFile:'reports/identity-fixture/proposed.json'}],
    ['fiction-library','Учебные референсы',{artifactKind:'product-reference-library',productId:'product',manifestFile:reference.library.manifestFile}],
  ]
}
async function failureStates(browser,url) {
  const page=await browser.newPage();page.setDefaultTimeout(15000)
  try {
    await page.route('**/api/snapshot',route=>route.fulfill({status:503,body:'unavailable'}))
    await page.goto(url+'/#product');await page.getByText('Не удалось открыть продукт',{exact:true}).waitFor()
    assert.equal(await page.getByRole('heading',{level:1}).count(),1)
    await page.unroute('**/api/snapshot');await page.getByRole('button',{name:'Повторить',exact:true}).click()
    await page.getByText('Один час в неделю; дополнительный бюджет 0.',{exact:true}).waitFor()
    let attempts=0
    await page.route('**/api/strategic-jobs?*',route=>++attempts===1?route.fulfill({status:503,body:'unavailable'}):route.continue())
    await page.goto(url+'/#jobs');await page.getByRole('button',{name:'Повторить загрузку карты',exact:true}).click()
    await page.getByRole('button',{name:'Список',exact:true}).waitFor();assert.equal(attempts,2)
    await page.goto(url+'/#research/'+encodeURIComponent('reports/missing.md'));await page.getByRole('heading',{name:'Результат не найден',exact:true}).waitFor()
    const missing=await page.goto(url+'/report?path=reports%2Fmissing.md');assert.equal(missing.status(),404)
    await page.getByRole('link',{name:'← Вернуться в консоль',exact:true}).waitFor()
    await page.route('**/api/product-identity?*',route=>route.fulfill({status:503,body:'unavailable'}))
    await page.goto(url+'/#library/identity');await page.getByText('Айдентика недоступна',{exact:true}).waitFor()
    await page.unroute('**/api/product-identity?*');await page.getByRole('button',{name:'Повторить загрузку',exact:true}).click()
    await page.getByRole('button',{name:'Версии и основания',exact:true}).waitFor()
    await page.route('**/api/product-references?*',route=>route.fulfill({status:503,body:'unavailable'}))
    await page.goto(url+'/#library/references');await page.getByText('Библиотека недоступна',{exact:true}).waitFor()
    await page.unroute('**/api/product-references?*');await page.getByRole('button',{name:'Повторить загрузку',exact:true}).click()
    await page.locator('.reference-card').first().waitFor()
  } finally {await page.close()}
}

async function main() {
  const keepRuntime=process.env.PRODUCT_OS_QA_KEEP_RUNTIME==='1'
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'product-os-public-ui-'))
  const output=path.resolve(process.env.PRODUCT_OS_QA_DIR||path.join(os.tmpdir(),'product-os-public-ui-evidence'))
  fs.mkdirSync(output,{recursive:true})
  fs.writeFileSync(path.join(dir,'PRODUCT.md'),'# Учебный продукт\n\nВымышленный сервис для хранения договорённостей команды.\n\n## Цель\nПроверить пользу общего контекста.\n\n## Ограничения\nОдин час в неделю; дополнительный бюджет 0.\n')
  init(dir)
  fs.writeFileSync(path.join(dir,'note.md'),'# Учебная заметка\n\nЭто вымышленный исходный материал для проверки консоли.\n')
  const source=importSource(dir,path.join(dir,'note.md'))
  const app=await createConsoleServer({workspace:dir,repoRoot:path.resolve(__dirname,'..'),bbPath:false,claudePath:false,chromeAgent:false})
  const address=await listen(app.server),url=`http://127.0.0.1:${address.port}`
  let browser,passed=false
  try {
    browser=await chromium.launch({channel:'chrome',headless:true})
    const blank=await browser.newPage();blank.setDefaultTimeout(15000)
    for(const [route,title] of [['segments','Сегментов пока нет'],['competitors','Конкурентов пока нет'],['jobs','Карта работ ещё не составлена'],['research','Исследований пока нет'],['library/identity','Айдентика пока не добавлена'],['library/references','Референсы пока не добавлены']]) {
      await blank.goto(url+'/#'+route);await blank.getByRole('heading',{name:title,exact:true}).waitFor()
    }
    await blank.close()
    const report=resultFixtures(dir,source.source)
    const registrations=await libraryFixtures(dir,url)
    const tx=new GraphTransaction(dir,{source:source.source})
    try {
      tx.node('seg-consultants','segment','Самостоятельные консультанты с длинным названием сегмента',{source:source.source,data:{description:'Согласовывают время встреч в переписке.',coreJob:'Договориться о встрече без длинной переписки.',criteria:['Клиент может выбрать время самостоятельно.']}})
      tx.node('comp-calendar','competitor','Учебный календарь',{source:source.source,data:{description:'Вымышленная альтернатива для сравнения.',url:'https://example.invalid/calendar',pricing:'Цена пока неизвестна.'}})
      tx.node('public-strategic-map','artifact','Вымышленная карта работ',{source:source.source,data:{artifactKind:'strategic-job-map',productId:'product',version:1,mapPath:'reports/strategic-jobs.json'}})
      for(const [id,label,data] of registrations)tx.node(id,'artifact',label,{source:source.source,data})
      tx.commit()
    } finally {tx.close()}
    const protectedFiles=['PRODUCT.md','MOVES.md','research-graph.json',source.source,report,'reports/strategic-jobs.json','reports/identity-fixture/identity.json','reports/identity-fixture/type.png','reports/reference-fixture/manifest.json','sources/reference-fixture/cards.json','sources/reference-fixture/sources.json','sources/reference-fixture/image.png'],before=protectedFiles.map(f=>hash(path.join(dir,f)))
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
      const page=await browser.newPage({viewport}),errors=[],writes=[]
      page.setDefaultTimeout(15000)
      page.on('pageerror',e=>errors.push(e.message))
      page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url())})
      await page.goto(url+'/#product')
      await page.getByText('Один час в неделю; дополнительный бюджет 0.',{exact:true}).waitFor()
      assert.deepEqual(await page.getByRole('navigation',{name:'Основные разделы'}).getByRole('link').allTextContents(),['Продукт','Сегменты','Карта работ','Конкуренты','Библиотека'])
      assert.equal(await page.getByRole('heading',{level:1}).count(),1)
      assert.equal(await page.getByText('Что дальше',{exact:true}).count(),0)
      assert.equal(await page.getByText('Каналы коммуникации',{exact:true}).count(),0)
      assert.equal(await page.locator('[data-skill-launch],#launchOverlay').count(),0)
      await page.screenshot({path:path.join(output,`product-${viewport.width}.png`),fullPage:true})
      await page.getByRole('link',{name:'Открыть паспорт продукта',exact:true}).click()
      await page.getByRole('heading',{name:'Учебный продукт',exact:true}).waitFor()
      await page.getByRole('link',{name:'← Вернуться в консоль',exact:true}).click()
      await page.getByRole('heading',{name:'Продукт',exact:true}).waitFor()
      await page.getByRole('link',{name:'Сегменты',exact:true}).click()
      await page.getByRole('link',{name:'Самостоятельные консультанты с длинным названием сегмента',exact:true}).click()
      await page.getByText('Договориться о встрече без длинной переписки.',{exact:true}).waitFor()
      await page.getByText('Клиент может выбрать время самостоятельно.',{exact:true}).waitFor()
      await page.getByRole('link',{name:'Открыть исходное описание',exact:true}).click()
      await page.getByText('Это вымышленный исходный материал для проверки консоли.',{exact:true}).waitFor()
      await page.getByRole('link',{name:'← Вернуться в консоль',exact:true}).click()
      await page.getByText('Договориться о встрече без длинной переписки.',{exact:true}).waitFor()
      await page.screenshot({path:path.join(output,`segment-${viewport.width}.png`),fullPage:true})
      await page.getByRole('link',{name:'Как консультанты находят решение',exact:true}).click()
      await page.getByText('Частичный результат',{exact:false}).waitFor()
      await page.getByRole('link',{name:'Открыть отчёт',exact:true}).click()
      await page.getByText('Изучен только поиск решения; удержание не исследовано.',{exact:true}).waitFor()
      const sourceOpened=page.waitForEvent('popup')
      await page.getByRole('link',{name:'Учебная заметка',exact:true}).click()
      const sourcePage=await sourceOpened
      await sourcePage.getByText('Это вымышленный исходный материал для проверки консоли.',{exact:true}).waitFor()
      await sourcePage.close()
      await page.getByText('Изучен только поиск решения; удержание не исследовано.',{exact:true}).waitFor()
      await page.getByRole('link',{name:'← Вернуться в консоль',exact:true}).click()
      await page.getByRole('heading',{name:'Как консультанты находят решение',exact:true}).waitFor()
      await page.screenshot({path:path.join(output,`research-${viewport.width}.png`),fullPage:true})
      const reportLink=page.getByRole('link',{name:'Открыть отчёт',exact:true})
      await reportLink.focus();await page.keyboard.press('Shift+Tab');await page.keyboard.press('Tab')
      assert.equal(await reportLink.evaluate(el=>el===document.activeElement&&el.matches(':focus-visible')),true)
      const colors=await reportLink.evaluate(el=>{
        const probe=document.createElement('span');el.append(probe)
        probe.style.color='var(--os-surface)';const foreground=getComputedStyle(probe).color
        probe.style.color='var(--os-text)';const background=getComputedStyle(probe).color;probe.remove()
        const style=getComputedStyle(el);return {color:style.color,background:style.backgroundColor,foreground,expectedBackground:background,outline:style.outlineStyle,outlineWidth:parseFloat(style.outlineWidth)}
      })
      assert.equal(colors.color,colors.foreground,'Primary link keeps shared surface foreground')
      assert.equal(colors.background,colors.expectedBackground,'Primary link keeps shared ink background')
      assert.equal(colors.outline,'solid');assert.ok(colors.outlineWidth>=3)
      await page.screenshot({path:path.join(output,`research-${viewport.width}-focused.png`),fullPage:true})
      await page.getByRole('link',{name:'← Самостоятельные консультанты с длинным названием сегмента',exact:true}).click()
      await page.getByRole('link',{name:'← Сегменты',exact:true}).click()
      await page.getByRole('heading',{name:'Сегменты',exact:true}).waitFor()
      await page.getByRole('link',{name:'Карта работ',exact:true}).click()
      await page.getByRole('button',{name:'Список',exact:true}).waitFor()
      await page.getByRole('button',{name:'Список',exact:true}).click()
      await page.getByRole('heading',{name:'Собрать предложения коллег',exact:true}).waitFor()
      await page.getByText('Помочь подготовить и сравнить варианты.',{exact:true}).first().waitFor()
      assert.equal(await page.getByText('Сохранить исходные заметки.',{exact:true}).count(),0,'Public reads the saved target offering, independently of tool edition')
      await page.getByText('Заметка о согласовании',{exact:true}).first().click()
      await page.getByText('Участник А хочет сравнить варианты. Участник Б передаёт их руководителю.',{exact:true}).first().waitFor()
      await page.screenshot({path:path.join(output,`jobs-list-${viewport.width}.png`),fullPage:true})
      await page.getByRole('button',{name:'Схема',exact:true}).click()
      await page.locator('[data-job=j1][data-state=ready]').first().waitFor()
      const map=page.locator('.strategic-job-map')
      await map.getByRole('button',{name:'Открыть граф: Выбрать вариант документа',exact:true}).click()
      await map.locator('.detail-panel').getByRole('button',{name:'Открыть работу: Собрать предложения коллег',exact:true}).click()
      await map.locator('.detail-panel').getByText('Помочь подготовить и сравнить варианты.',{exact:true}).waitFor()
      assert.equal(await map.locator('.detail-panel').getByText('Полная версия',{exact:true}).count(),0)
      await map.getByRole('button',{name:/^Контекст и критерии сегмента:/}).first().click()
      assert.equal(await map.getByRole('link',{name:'Открыть граф работ сегмента',exact:false}).count(),0)
      await map.getByRole('link',{name:'Открыть профиль сегмента',exact:false}).click()
      await page.getByText('Договориться о встрече без длинной переписки.',{exact:true}).waitFor()
      await page.goBack();await page.locator('[data-job=j1]').first().waitFor()
      await page.getByRole('button',{name:'Развернуть карту',exact:true}).click()
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('.strategic-job-full').count(),0)
      await page.screenshot({path:path.join(output,`jobs-canvas-${viewport.width}.png`),fullPage:true})
      await page.getByRole('link',{name:'Конкуренты',exact:true}).click()
      await page.getByRole('link',{name:'Учебный календарь',exact:true}).click()
      await page.getByText('Цена пока неизвестна.',{exact:true}).waitFor()
      assert.equal(await page.getByRole('link',{name:'https://example.invalid/calendar',exact:true}).getAttribute('href'),'https://example.invalid/calendar')
      await page.screenshot({path:path.join(output,`competitor-${viewport.width}.png`),fullPage:true})
      await page.getByRole('link',{name:'Библиотека',exact:true}).click()
      const identity=page.locator('[data-product-identity]')
      await identity.getByRole('heading',{name:'Цвета',exact:true}).waitFor()
      await page.waitForFunction(()=>{const img=document.querySelector('[data-brand-image]');return img?.complete&&img.naturalWidth>0})
      await identity.getByRole('button',{name:'Версии и основания',exact:true}).click()
      const history=page.getByRole('dialog',{name:'Версии и основания',exact:true})
      assert.match(await history.getByRole('combobox',{name:'Версия айдентики',exact:true}).locator('option:checked').innerText(),/версия 1 · записана как принятая$/)
      await page.keyboard.press('Escape')
      const download=page.waitForEvent('download')
      await identity.getByRole('link',{name:'Скачать: Образец типографики',exact:true}).click()
      assert.equal((await download).suggestedFilename(),'type.png')
      await page.screenshot({path:path.join(output,`identity-${viewport.width}.png`),fullPage:true})
      await identity.getByRole('button',{name:'Версии и основания',exact:true}).click()
      await history.getByRole('combobox',{name:'Версия айдентики',exact:true}).selectOption('fiction-proposal')
      await identity.getByText('Эта айдентика ещё не утверждена.',{exact:true}).waitFor()
      await identity.getByRole('button',{name:'Версии и основания',exact:true}).click()
      assert.match(await history.getByRole('combobox',{name:'Версия айдентики',exact:true}).locator('option:checked').innerText(),/версия 2 · предложение$/)
      await page.keyboard.press('Escape')
      await page.screenshot({path:path.join(output,`identity-proposed-${viewport.width}.png`),fullPage:true})
      await page.getByRole('link',{name:'Референсы',exact:true}).click()
      await page.getByText('Фильтры',{exact:true}).click()
      await page.getByRole('combobox',{name:'Конкурент',exact:true}).selectOption('fiction-app')
      assert.equal(await page.locator('.reference-card').count(),1)
      await readReferenceImages(page)
      await page.locator('.reference-card h2 a').click()
      await page.locator('.reference-detail').waitFor()
      assert.equal(await page.getByRole('heading',{level:1}).count(),1)
      await readReferenceImages(page)
      await page.getByRole('button',{name:'Увеличить:',exact:false}).first().click()
      await page.locator('.os-dialog').waitFor()
      await page.keyboard.press('Escape')
      await page.screenshot({path:path.join(output,`reference-${viewport.width}.png`),fullPage:true})
      await page.getByText('Исходные материалы',{exact:true}).click()
      const original=page.locator('.reference-sources').getByRole('link',{name:'Открыть оригинал',exact:true}).first(),opened=page.waitForEvent('popup')
      await original.click();const source=await opened
      await source.getByText('Синтетические данные только для проверки источников и возврата.',{exact:true}).waitFor();await source.close()
      await page.getByRole('link',{name:'← К референсам',exact:true}).click()
      assert.equal(new URLSearchParams(page.url().split('?')[1]).get('competitor'),'fiction-app')
      await page.locator('.reference-card').waitFor()
      for(const [legacy,title] of [['next','Продукт'],['skills','Продукт'],['product/brief','Продукт'],['reports','Материалы'],['map','Сегменты'],['hangar','Конкуренты']]) {
        await page.goto(url+'/#'+legacy);await page.getByRole('heading',{name:title,exact:true}).waitFor()
      }
      await page.getByRole('link',{name:'Карта работ',exact:true}).click()
      await page.getByRole('button',{name:'Список',exact:true}).click()
      await page.evaluate(()=>{document.documentElement.style.fontSize='200%'})
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+2),true,'Page must not scroll horizontally')
      for(const link of await page.getByRole('navigation',{name:'Основные разделы'}).getByRole('link').all()) {
        const box=await link.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+2,'Every main section must fit horizontally')
      }
      await page.screenshot({path:path.join(output,`jobs-list-${viewport.width}-200.png`),fullPage:true})
      await page.getByRole('link',{name:'Самостоятельные консультанты с длинным названием сегмента',exact:true}).click()
      await page.getByRole('link',{name:'Как консультанты находят решение',exact:true}).click()
      assert.equal(await page.getByRole('heading',{level:1}).count(),1)
      await page.screenshot({path:path.join(output,`research-${viewport.width}-200.png`),fullPage:true})
      await page.getByRole('link',{name:'Библиотека',exact:true}).click()
      await page.waitForFunction(()=>{const img=document.querySelector('[data-brand-image]');return img?.complete&&img.naturalWidth>0})
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+2),true)
      await page.screenshot({path:path.join(output,`identity-${viewport.width}-200.png`),fullPage:true})
      await page.getByRole('link',{name:'Референсы',exact:true}).click()
      await page.getByText('Фильтры',{exact:true}).click()
      await page.getByRole('combobox',{name:'Конкурент',exact:true}).selectOption('fiction-app')
      await page.locator('.reference-card h2 a').click()
      await page.locator('.reference-detail').waitFor()
      await readReferenceImages(page)
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+2),true)
      await page.screenshot({path:path.join(output,`reference-${viewport.width}-200.png`),fullPage:true})
      assert.deepEqual(errors,[]);assert.deepEqual(writes,[])
      await page.close()
    }
    await failureStates(browser,url)
    await offeringScopes(browser,url,dir,output)
    assert.deepEqual(protectedFiles.map(f=>hash(path.join(dir,f))),before,'Reading must not change product data')
    passed=true
    console.log(JSON.stringify({passed:true,sections:5,viewports:[1440,390],textScale:'200%',writes:0,evidence:output,...(keepRuntime?{url,workspace:dir}:{})},null,2))
  } catch(error) {
    const pages=browser?.contexts().flatMap(context=>context.pages())||[]
    const page=pages.at(-1)
    if(page&&!page.isClosed()) {
      await page.screenshot({path:path.join(output,'failure.png'),fullPage:true}).catch(()=>{})
      await page.locator('body').innerText().then(text=>fs.writeFileSync(path.join(output,'failure.txt'),text)).catch(()=>{})
    }
    throw error
  } finally {
    if(browser)await browser.close()
    if(!keepRuntime||!passed){await new Promise(resolve=>app.server.close(resolve));fs.rmSync(dir,{recursive:true,force:true})}
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
