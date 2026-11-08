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
  fs.writeFileSync(path.join(dir,report),`---\ntitle: How consultants find solutions\nskill: product-deep-research\nnodeId: seg-consultants\noutcome: partial\ndate: 2026-10-21\nsummary: Calendar selection examples found. Willingness to pay has not yet been verified.\n---\n# How consultants find solutions\n\nCalendar selection examples found. Willingness to pay has not yet been verified.\n\n## Scope and restrictions\nOnly solution search explored; retention not studied.\n\n## Source\n[Study note](../${source})\n`)
  const map=JSON.parse(JSON.stringify(require('./fixtures/strategic-job-example.json')))
  map.scope={edition:'full'}
  map.editions={full:"Current training service offering",public:"Free offer of training service"}
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
        await page.goto(url+'/#jobs');await page.getByRole('button',{name:"List",exact:true}).click()
        const selected=edition==='public'?'public':'full',other=selected==='public'?'full':'public',expected=map.jobs.j1[selected]
        await page.getByText(expected.contribution,{exact:true}).first().waitFor()
        if(expected.state==='ready')await page.getByText("Available in product",{exact:true}).first().waitFor()
        assert.equal(await page.getByText(map.jobs.j1[other].contribution,{exact:true}).count(),0)
        assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`map-scope-${edition}-list.png`),fullPage:true})
        await page.getByRole('button',{name:"Diagram",exact:true}).click()
        await page.locator(`[data-job=j1][data-state=${expected.state}]`).first().waitFor()
        const response=await fetch(url+'/api/strategic-jobs?productId=product'),value=await response.json()
        assert.equal(value.state,'ready');assert.deepEqual(value.map.jobs.j1.full,map.jobs.j1.full);assert.deepEqual(value.map.jobs.j1.public,map.jobs.j1.public)
        fs.writeFileSync(path.join(cases,edition+'-response.json'),JSON.stringify(value))
        fs.writeFileSync(path.join(output,'map-scope-'+edition+'-response.json'),JSON.stringify(value))
        // An explicit old caller option is only a fallback: saved scope wins.
        await page.evaluate(({data,edition})=>{document.querySelector('#publicMapReading').innerHTML=window.JobFlow.strategicMarkup('product',data,{edition,profileLinksOnly:true})},{data:value,edition:edition==='legacy'?'full':other})
        await page.locator(`[data-job=j1][data-state=${expected.state}]`).first().waitFor()
        assert.equal(await page.locator(`[data-job=j1][data-state=${expected.state}]`).count(),2)
        assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
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
  write(profile.decisionSource,"# Training choice\n\nThis is a fictitious decision to check acceptance status.\n")
  const proposed={...profile,version:2,decision:'proposed'};delete proposed.decisionSource
  write('reports/identity-fixture/proposed.json',proposed)
  const reference=(await import('./fixtures/reference-example.mjs')).referenceExample({singleTrack:true})
  const cards=[reference.cards[0],reference.cards.at(-1)].map(row=>structuredClone(row.card))
  cards.forEach(card=>card.media.forEach(media=>delete media.previewURL))
  const sources=reference.cards[0].sources.map(source=>({...source,url:url+'/source?path=reports%2Freference-fixture%2Foriginal.md'}))
  write(reference.library.manifestFile,{schemaVersion:1,productId:'product',libraryId:'fiction',title:"Study library",status:'ready-for-review-partial',tracks:[{key:'path',title:"Path and sequence",cardsPath:'sources/reference-fixture/cards.json',sourcesPath:'sources/reference-fixture/sources.json'}],gaps:["Data is fictitious; the effect on the client has not been verified."]})
  write('sources/reference-fixture/cards.json',{schemaVersion:1,cards})
  write('sources/reference-fixture/sources.json',{schemaVersion:1,sources})
  write('reports/reference-fixture/original.md',"# Training source directory\n\nSynthetic data for checking sources and returns only.\n")
  fs.copyFileSync(path.resolve(__dirname,'fixtures/reference-example.png'),path.join(dir,'sources/reference-fixture/image.png'))
  return [
    ['fiction-identity',"Educational identity",{kind:'visual-profile',artifactKind:'brand-identity',productId:'product',version:1,decision:'accepted',decisionSource:profile.decisionSource,profileFile:'reports/identity-fixture/identity.json'}],
    ['fiction-proposal',"Identity proposal",{kind:'visual-profile',artifactKind:'brand-identity',productId:'product',version:2,decision:'proposed',profileFile:'reports/identity-fixture/proposed.json'}],
    ['fiction-library',"Training references",{artifactKind:'product-reference-library',productId:'product',manifestFile:reference.library.manifestFile}],
  ]
}
async function failureStates(browser,url) {
  const page=await browser.newPage();page.setDefaultTimeout(15000)
  try {
    await page.route('**/api/snapshot',route=>route.fulfill({status:503,body:'unavailable'}))
    await page.goto(url+'/#product');await page.getByText("Failed to open product",{exact:true}).waitFor()
    assert.equal(await page.getByRole('heading',{level:1}).count(),1)
    await page.unroute('**/api/snapshot');await page.getByRole('button',{name:"Repeat",exact:true}).click()
    await page.getByText("One hour per week; additional budget 0.",{exact:true}).waitFor()
    let attempts=0
    await page.route('**/api/strategic-jobs?*',route=>++attempts===1?route.fulfill({status:503,body:'unavailable'}):route.continue())
    await page.goto(url+'/#jobs');await page.getByRole('button',{name:"Retry loading map",exact:true}).click()
    await page.getByRole('button',{name:"List",exact:true}).waitFor();assert.equal(attempts,2)
    await page.goto(url+'/#research/'+encodeURIComponent('reports/missing.md'));await page.getByRole('heading',{name:"Result not found",exact:true}).waitFor()
    const missing=await page.goto(url+'/report?path=reports%2Fmissing.md');assert.equal(missing.status(),404)
    await page.getByRole('link',{name:"← Return to console",exact:true}).waitFor()
    await page.route('**/api/product-identity?*',route=>route.fulfill({status:503,body:'unavailable'}))
    await page.goto(url+'/#library/identity');await page.getByText("Brand identity unavailable",{exact:true}).waitFor()
    await page.unroute('**/api/product-identity?*');await page.getByRole('button',{name:"Retry loading",exact:true}).click()
    await page.getByRole('button',{name:"Versions and sources",exact:true}).waitFor()
    await page.route('**/api/product-references?*',route=>route.fulfill({status:503,body:'unavailable'}))
    await page.goto(url+'/#library/references');await page.getByText("Library unavailable",{exact:true}).waitFor()
    await page.unroute('**/api/product-references?*');await page.getByRole('button',{name:"Retry loading",exact:true}).click()
    await page.locator('.reference-card').first().waitFor()
  } finally {await page.close()}
}

async function main() {
  const keepRuntime=process.env.PRODUCT_OS_QA_KEEP_RUNTIME==='1'
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'product-os-public-ui-'))
  const output=path.resolve(process.env.PRODUCT_OS_QA_DIR||path.join(os.tmpdir(),'product-os-public-ui-evidence'))
  fs.mkdirSync(output,{recursive:true})
  fs.writeFileSync(path.join(dir,'PRODUCT.md'),"# Educational product\n\nFictional service for storing team agreements.\n\n## Goal\nTest the usefulness of the general context.\n\n## Constraints\nOne hour per week; additional budget 0.\n")
  init(dir)
  fs.writeFileSync(path.join(dir,'note.md'),"# Tutorial note\n\nThis is fictional source material for testing the console.\n")
  const source=importSource(dir,path.join(dir,'note.md'))
  const app=await createConsoleServer({workspace:dir,repoRoot:path.resolve(__dirname,'..'),bbPath:false,claudePath:false,chromeAgent:false})
  const address=await listen(app.server),url=`http://127.0.0.1:${address.port}`
  let browser,passed=false
  try {
    browser=await chromium.launch({channel:'chrome',headless:true})
    const blank=await browser.newPage();blank.setDefaultTimeout(15000)
    for(const [route,title] of [['segments',"No segments yet"],['competitors',"No competitors yet"],['jobs',"No job map yet"],['research',"No research yet"],['library/identity',"No brand identity yet"],['library/references',"No references yet"]]) {
      await blank.goto(url+'/#'+route);await blank.getByRole('heading',{name:title,exact:true}).waitFor()
    }
    await blank.close()
    const report=resultFixtures(dir,source.source)
    const registrations=await libraryFixtures(dir,url)
    const tx=new GraphTransaction(dir,{source:source.source})
    try {
      tx.node('seg-consultants','segment',"Independent consultants with a long segment name",{source:source.source,data:{description:"Agree on meeting times via correspondence.",coreJob:"Arrange a meeting without lengthy correspondence.",criteria:["The client can choose the time himself."]}})
      tx.node('comp-calendar','competitor',"Academic calendar",{source:source.source,data:{description:"Fictional alternative for comparison.",url:'https://example.invalid/calendar',pricing:"Price unknown yet."}})
      tx.node('public-strategic-map','artifact',"Fictitious job map",{source:source.source,data:{artifactKind:'strategic-job-map',productId:'product',version:1,mapPath:'reports/strategic-jobs.json'}})
      for(const [id,label,data] of registrations)tx.node(id,'artifact',label,{source:source.source,data})
      tx.commit()
    } finally {tx.close()}
    const protectedFiles=['PRODUCT.md','MOVES.md','research-graph.json',source.source,report,'reports/strategic-jobs.json','reports/identity-fixture/identity.json','reports/identity-fixture/type.png','reports/reference-fixture/manifest.json','sources/reference-fixture/cards.json','sources/reference-fixture/sources.json','sources/reference-fixture/image.png'],before=protectedFiles.map(f=>hash(path.join(dir,f)))
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
      const page=await browser.newPage({viewport}),errors=[],writes=[]
      page.setDefaultTimeout(15000)
      page.on('pageerror',e=>errors.push(e.message))
      page.on('request',r=>{assert.equal(new URL(r.url()).origin,url,'The local console must not make third-party requests');if(!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url())})
      await page.goto(url+'/#product')
      await page.getByText("One hour per week; additional budget 0.",{exact:true}).waitFor()
      assert.deepEqual(await page.getByRole('navigation',{name:"Main navigation"}).getByRole('link').allTextContents(),["Product","Segments","Job map","Competitors","Library"])
      assert.equal(await page.getByRole('heading',{level:1}).count(),1)
      assert.equal(await page.getByText("What's next",{exact:true}).count(),0)
      assert.equal(await page.getByText("Communication channels",{exact:true}).count(),0)
      assert.equal(await page.locator('[data-skill-launch],#launchOverlay').count(),0)
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`product-${viewport.width}.png`),fullPage:true})
      await page.getByRole('link',{name:"Open product profile",exact:true}).click()
      await page.getByRole('heading',{name:"Educational product",exact:true}).waitFor()
      await page.getByRole('link',{name:"← Return to console",exact:true}).click()
      await page.getByRole('heading',{name:"Product",exact:true}).waitFor()
      await page.getByRole('link',{name:"Segments",exact:true}).click()
      await page.getByRole('link',{name:"Independent consultants with a long segment name",exact:true}).click()
      await page.getByText("Arrange a meeting without lengthy correspondence.",{exact:true}).waitFor()
      await page.getByText("The client can choose the time himself.",{exact:true}).waitFor()
      await page.getByRole('link',{name:"Open original description",exact:true}).click()
      await page.getByText("This is fictional source material for testing the console.",{exact:true}).waitFor()
      await page.getByRole('link',{name:"← Return to console",exact:true}).click()
      await page.getByText("Arrange a meeting without lengthy correspondence.",{exact:true}).waitFor()
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`segment-${viewport.width}.png`),fullPage:true})
      await page.getByRole('link',{name:"How consultants find solutions",exact:true}).click()
      await page.getByText("Partial result",{exact:false}).waitFor()
      await page.getByRole('link',{name:"Open report",exact:true}).click()
      await page.getByText("Only solution search explored; retention not studied.",{exact:true}).waitFor()
      const sourceOpened=page.waitForEvent('popup')
      await page.getByRole('link',{name:"Study note",exact:true}).click()
      const sourcePage=await sourceOpened
      await sourcePage.getByText("This is fictional source material for testing the console.",{exact:true}).waitFor()
      await sourcePage.close()
      await page.getByText("Only solution search explored; retention not studied.",{exact:true}).waitFor()
      await page.getByRole('link',{name:"← Return to console",exact:true}).click()
      await page.getByRole('heading',{name:"How consultants find solutions",exact:true}).waitFor()
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`research-${viewport.width}.png`),fullPage:true})
      const reportLink=page.getByRole('link',{name:"Open report",exact:true})
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
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`research-${viewport.width}-focused.png`),fullPage:true})
      await page.getByRole('link',{name:"← Independent consultants with a long segment name",exact:true}).click()
      await page.getByRole('link',{name:"← Segments",exact:true}).click()
      await page.getByRole('heading',{name:"Segments",exact:true}).waitFor()
      await page.getByRole('link',{name:"Job map",exact:true}).click()
      await page.getByRole('button',{name:"List",exact:true}).waitFor()
      await page.getByRole('button',{name:"List",exact:true}).click()
      await page.getByRole('heading',{name:"Collect suggestions from colleagues",exact:true}).waitFor()
      await page.getByText("Help prepare and compare options.",{exact:true}).first().waitFor()
      assert.equal(await page.getByText("Save original notes.",{exact:true}).count(),0,'Public reads the saved target offering, independently of tool edition')
      await page.getByText("Reconciliation note",{exact:true}).first().click()
      await page.getByText("Participant A wants to compare options. Participant B passes them on to the manager.",{exact:true}).first().waitFor()
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`jobs-list-${viewport.width}.png`),fullPage:true})
      await page.getByRole('button',{name:"Diagram",exact:true}).click()
      await page.locator('[data-job=j1][data-state=ready]').first().waitFor()
      const map=page.locator('.strategic-job-map')
      await map.getByRole('button',{name:'Open graph: '+require('./fixtures/strategic-job-example.json').jobs.g1.label,exact:true}).click()
      await map.locator('.detail-panel').getByRole('button',{name:'Open job: '+require('./fixtures/strategic-job-example.json').jobs.j1.label,exact:true}).click()
      await map.locator('.detail-panel').getByText("Help prepare and compare options.",{exact:true}).waitFor()
      assert.equal(await map.locator('.detail-panel').getByText("Full version",{exact:true}).count(),0)
      await map.getByRole('button',{name:/^Segment context and criteria:/}).first().click()
      assert.equal(await map.getByRole('link',{name:"Open segment work graph",exact:false}).count(),0)
      await map.getByRole('link',{name:"Open segment profile",exact:false}).click()
      await page.getByText("Arrange a meeting without lengthy correspondence.",{exact:true}).waitFor()
      await page.goBack();await page.locator('[data-job=j1]').first().waitFor()
      await page.getByRole('button',{name:"Expand map",exact:true}).click()
      await page.keyboard.press('Escape')
      assert.equal(await page.locator('.strategic-job-full').count(),0)
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`jobs-canvas-${viewport.width}.png`),fullPage:true})
      await page.getByRole('link',{name:"Competitors",exact:true}).click()
      await page.getByRole('link',{name:"Academic calendar",exact:true}).click()
      await page.getByText("Price unknown yet.",{exact:true}).waitFor()
      assert.equal(await page.getByRole('link',{name:'https://example.invalid/calendar',exact:true}).getAttribute('href'),'https://example.invalid/calendar')
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`competitor-${viewport.width}.png`),fullPage:true})
      await page.getByRole('link',{name:"Library",exact:true}).click()
      const identity=page.locator('[data-product-identity]')
      await identity.getByRole('heading',{name:"Colors",exact:true}).waitFor()
      await page.waitForFunction(()=>{const img=document.querySelector('[data-brand-image]');return img?.complete&&img.naturalWidth>0})
      await identity.getByRole('button',{name:"Versions and sources",exact:true}).click()
      const history=page.getByRole('dialog',{name:"Versions and sources",exact:true})
      assert.match(await history.getByRole('combobox',{name:"Identity version",exact:true}).locator('option:checked').innerText(),/version 1 · recorded as accepted$/)
      await page.keyboard.press('Escape')
      const [download]=await Promise.all([page.waitForEvent('download'),identity.getByRole('link',{name:"Download: Typography sample",exact:true}).click()])
      assert.equal(download.suggestedFilename(),'type.png')
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`identity-${viewport.width}.png`),fullPage:true})
      await identity.getByRole('button',{name:"Versions and sources",exact:true}).click()
      await history.getByRole('combobox',{name:"Identity version",exact:true}).selectOption('fiction-proposal')
      await identity.getByText("This identity has not yet been approved.",{exact:true}).waitFor()
      await identity.getByRole('button',{name:"Versions and sources",exact:true}).click()
      assert.match(await history.getByRole('combobox',{name:"Identity version",exact:true}).locator('option:checked').innerText(),/version 2 · proposal$/)
      await page.keyboard.press('Escape')
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`identity-proposed-${viewport.width}.png`),fullPage:true})
      await page.getByRole('link',{name:"References",exact:true}).click()
      await page.getByText("Filters",{exact:true}).click()
      await page.getByRole('combobox',{name:"Competitor",exact:true}).selectOption('fiction-app')
      assert.equal(await page.locator('.reference-card').count(),1)
      await readReferenceImages(page)
      await page.locator('.reference-card h2 a').click()
      await page.locator('.reference-detail').waitFor()
      assert.equal(await page.getByRole('heading',{level:1}).count(),1)
      await readReferenceImages(page)
      await page.getByRole('button',{name:"Increase:",exact:false}).first().click()
      await page.locator('.os-dialog').waitFor()
      await page.keyboard.press('Escape')
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`reference-${viewport.width}.png`),fullPage:true})
      await page.getByText("Source materials",{exact:true}).click()
      const original=page.locator('.reference-sources').getByRole('link',{name:"Open original",exact:true}).first(),opened=page.waitForEvent('popup')
      await original.click();const source=await opened
      await source.getByText("Synthetic data for checking sources and returns only.",{exact:true}).waitFor();await source.close()
      await page.getByRole('link',{name:"← To references",exact:true}).click()
      assert.equal(new URLSearchParams(page.url().split('?')[1]).get('competitor'),'fiction-app')
      await page.locator('.reference-card').waitFor()
      for(const [legacy,title] of [['next',"Product"],['skills',"Product"],['product/brief',"Product"],['reports',"Materials"],['map',"Segments"],['hangar',"Competitors"]]) {
        await page.goto(url+'/#'+legacy);await page.getByRole('heading',{name:title,exact:true}).waitFor()
      }
      await page.getByRole('link',{name:"Job map",exact:true}).click()
      await page.getByRole('button',{name:"List",exact:true}).click()
      await page.evaluate(()=>{document.documentElement.style.fontSize='200%'})
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+2),true,'Page must not scroll horizontally')
      for(const link of await page.getByRole('navigation',{name:"Main navigation"}).getByRole('link').all()) {
        const box=await link.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+2,'Every main section must fit horizontally')
      }
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`jobs-list-${viewport.width}-200.png`),fullPage:true})
      await page.getByRole('link',{name:"Independent consultants with a long segment name",exact:true}).click()
      await page.getByRole('link',{name:"How consultants find solutions",exact:true}).click()
      assert.equal(await page.getByRole('heading',{level:1}).count(),1)
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`research-${viewport.width}-200.png`),fullPage:true})
      await page.getByRole('link',{name:"Library",exact:true}).click()
      await page.waitForFunction(()=>{const img=document.querySelector('[data-brand-image]');return img?.complete&&img.naturalWidth>0})
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+2),true)
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
      await page.screenshot({path:path.join(output,`identity-${viewport.width}-200.png`),fullPage:true})
      await page.getByRole('link',{name:"References",exact:true}).click()
      await page.getByText("Filters",{exact:true}).click()
      await page.getByRole('combobox',{name:"Competitor",exact:true}).selectOption('fiction-app')
      await page.locator('.reference-card h2 a').click()
      await page.locator('.reference-detail').waitFor()
      await readReferenceImages(page)
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+2),true)
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
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
      assert.doesNotMatch(await page.locator('body').innerText(),/[А-Яа-яЁё]/,'The English fixture should render entirely in English');
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
