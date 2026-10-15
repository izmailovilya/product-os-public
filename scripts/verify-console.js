// Local UI check. Uses an installed Chrome and only fictional temporary data.
const assert = require('node:assert/strict')
const fs = require('node:fs')
const path = require('node:path')
const os = require('node:os')
const { chromium } = require('@playwright/test')
const { init, importSource } = require('../bin/public-workspace')
const { createConsoleServer, listen } = require('../bin/console/server')

async function main() {
  const dir=fs.mkdtempSync(path.join(os.tmpdir(),'product-os-public-ui-'))
  const output=path.resolve(process.env.PRODUCT_OS_QA_DIR || path.join(os.tmpdir(),'product-os-public-ui-evidence'))
  fs.mkdirSync(output,{recursive:true})
  fs.writeFileSync(path.join(dir,'PRODUCT.md'),'# Учебный продукт\n\nВымышленный сервис для хранения договорённостей команды.\n\n## Цель\nПроверить пользу общего контекста.\n')
  init(dir)
  fs.writeFileSync(path.join(dir,'note.md'),'# Учебная заметка\n\nЭто вымышленный исходный материал для проверки консоли.\n')
  importSource(dir,path.join(dir,'note.md'))
  const app=await createConsoleServer({workspace:dir,repoRoot:path.resolve(__dirname,'..'),bbPath:false,claudePath:false,chromeAgent:false})
  const address=await listen(app.server),url=`http://127.0.0.1:${address.port}`
  let browser
  try {
    browser=await chromium.launch({channel:'chrome',headless:true})
    for(const viewport of [{width:1440,height:1000},{width:390,height:844}]) {
      const page=await browser.newPage({viewport}),errors=[]
      page.on('pageerror',error=>errors.push(error.message))
      await page.goto(url+'/#product');await page.getByRole('heading',{name:'Обзор продукта',exact:true}).waitFor()
      await page.getByText('Вымышленный сервис для хранения договорённостей команды.',{exact:true}).waitFor()
      await page.screenshot({path:path.join(output,`product-${viewport.width}.png`),fullPage:true})
      await page.goto(url+'/#skills')
      for(const name of ['Настроить рабочее место','Добавить контекст','Где мы и что дальше'])await page.getByRole('heading',{name,exact:true}).waitFor()
      assert.equal(await page.locator('[data-skill-launch]').count(),3)
      assert.equal(await page.locator('[data-skill-toggle]').count(),0)
      await page.locator('[data-skill-launch="product-status"]').click()
      await page.locator('#launchOverlay').waitFor({state:'visible'})
      assert.match(await page.locator('#launchPrompt').textContent(),/\/product-status/)
      assert.doesNotMatch(await page.locator('#launchPrompt').textContent(),/Сохрани предоставленные материалы/)
      await page.keyboard.press('Escape')
      await page.locator('#launchOverlay').waitFor({state:'hidden'})
      await page.screenshot({path:path.join(output,`skills-${viewport.width}.png`),fullPage:true})
      await page.goto(url+'/#reports');await page.getByRole('button',{name:'Открыть оригинал',exact:true}).or(page.getByRole('link',{name:'Открыть оригинал',exact:true})).click()
      await page.getByText('Это вымышленный исходный материал для проверки консоли.',{exact:true}).waitFor()
      await page.goBack();await page.getByRole('heading',{name:'Исходные материалы',exact:true}).waitFor()
      await page.screenshot({path:path.join(output,`sources-${viewport.width}.png`),fullPage:true})
      await page.goto(url+'/#skills');await page.getByRole('heading',{name:'Добавить контекст',exact:true}).waitFor()
      await page.evaluate(()=>{document.documentElement.style.fontSize='200%'})
      await page.screenshot({path:path.join(output,`skills-${viewport.width}-200.png`),fullPage:true})
      assert.equal(await page.locator('body').evaluate(el=>el.scrollWidth<=innerWidth+2),true,'Page must not scroll horizontally')
      assert.deepEqual(errors,[])
      await page.close()
    }
    console.log(JSON.stringify({passed:true,url,viewports:[1440,390],textScale:'200%',evidence:output},null,2))
  } finally {
    if(browser)await browser.close()
    await new Promise(resolve=>app.server.close(resolve))
    fs.rmSync(dir,{recursive:true,force:true})
  }
}
main().catch(error=>{console.error(error);process.exitCode=1})
