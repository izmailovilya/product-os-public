// Public's three main sections. Only fictional data, no agent integrations.
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

async function main() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'product-os-public-ui-'))
  const output=path.resolve(process.env.PRODUCT_OS_QA_DIR||path.join(os.tmpdir(),'product-os-public-ui-evidence'))
  fs.mkdirSync(output,{recursive:true})
  fs.writeFileSync(path.join(dir,'PRODUCT.md'),'# Учебный продукт\n\nВымышленный сервис для хранения договорённостей команды.\n\n## Цель\nПроверить пользу общего контекста.\n\n## Ограничения\nОдин час в неделю; дополнительный бюджет 0.\n')
  init(dir)
  fs.writeFileSync(path.join(dir,'note.md'),'# Учебная заметка\n\nЭто вымышленный исходный материал для проверки консоли.\n')
  const source=importSource(dir,path.join(dir,'note.md'))
  const app=await createConsoleServer({workspace:dir,repoRoot:path.resolve(__dirname,'..'),bbPath:false,claudePath:false,chromeAgent:false})
  const address=await listen(app.server),url=`http://127.0.0.1:${address.port}`
  let browser
  try {
    browser=await chromium.launch({channel:'chrome',headless:true})
    const blank=await browser.newPage();blank.setDefaultTimeout(15000)
    for(const [route,title] of [['segments','Сегментов пока нет'],['competitors','Конкурентов пока нет']]) {
      await blank.goto(url+'/#'+route);await blank.getByRole('heading',{name:title,exact:true}).waitFor()
    }
    await blank.close()
    const tx=new GraphTransaction(dir,{source:source.source})
    try {
      tx.node('seg-consultants','segment','Самостоятельные консультанты с длинным названием сегмента',{source:source.source,data:{description:'Согласовывают время встреч в переписке.',coreJob:'Договориться о встрече без длинной переписки.',criteria:['Клиент может выбрать время самостоятельно.']}})
      tx.node('comp-calendar','competitor','Учебный календарь',{source:source.source,data:{description:'Вымышленная альтернатива для сравнения.',url:'https://example.invalid/calendar',pricing:'Цена пока неизвестна.'}})
      tx.commit()
    } finally {tx.close()}
    const protectedFiles=['PRODUCT.md','MOVES.md','research-graph.json',source.source],before=protectedFiles.map(f=>hash(path.join(dir,f)))
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
      const page=await browser.newPage({viewport}),errors=[],writes=[]
      page.setDefaultTimeout(15000)
      page.on('pageerror',e=>errors.push(e.message))
      page.on('request',r=>{if(!['GET','HEAD'].includes(r.method()))writes.push(r.method()+' '+r.url())})
      await page.goto(url+'/#product')
      await page.getByText('Один час в неделю; дополнительный бюджет 0.',{exact:true}).waitFor()
      assert.deepEqual(await page.getByRole('navigation',{name:'Основные разделы'}).getByRole('link').allTextContents(),['Продукт','Сегменты','Конкуренты'])
      assert.equal(await page.getByRole('heading',{level:1}).count(),1)
      assert.equal(await page.getByText('Что дальше',{exact:true}).count(),0)
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
      await page.getByRole('link',{name:'← Сегменты',exact:true}).click()
      await page.getByRole('heading',{name:'Сегменты',exact:true}).waitFor()
      await page.getByRole('link',{name:'Конкуренты',exact:true}).click()
      await page.getByRole('link',{name:'Учебный календарь',exact:true}).click()
      await page.getByText('Цена пока неизвестна.',{exact:true}).waitFor()
      assert.equal(await page.getByRole('link',{name:'https://example.invalid/calendar',exact:true}).getAttribute('href'),'https://example.invalid/calendar')
      await page.screenshot({path:path.join(output,`competitor-${viewport.width}.png`),fullPage:true})
      for(const [legacy,title] of [['next','Продукт'],['skills','Продукт'],['product/brief','Продукт'],['reports','Материалы'],['map','Сегменты'],['hangar','Конкуренты']]) {
        await page.goto(url+'/#'+legacy);await page.getByRole('heading',{name:title,exact:true}).waitFor()
      }
      await page.evaluate(()=>{document.documentElement.style.fontSize='200%'})
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+2),true,'Page must not scroll horizontally')
      for(const link of await page.getByRole('navigation',{name:'Основные разделы'}).getByRole('link').all()) {
        const box=await link.boundingBox();assert.ok(box.x>=0&&box.x+box.width<=viewport.width+2,'Every main section must fit horizontally')
      }
      await page.screenshot({path:path.join(output,`competitors-${viewport.width}-200.png`),fullPage:true})
      assert.deepEqual(errors,[]);assert.deepEqual(writes,[])
      await page.close()
    }
    assert.deepEqual(protectedFiles.map(f=>hash(path.join(dir,f))),before,'Reading must not change product data')
    console.log(JSON.stringify({passed:true,sections:3,viewports:[1440,390],textScale:'200%',writes:0,evidence:output},null,2))
  } finally {
    if(browser)await browser.close()
    await new Promise(resolve=>app.server.close(resolve))
    fs.rmSync(dir,{recursive:true,force:true})
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
