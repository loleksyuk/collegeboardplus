const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
(async () => {
 const server = http.createServer((req,res) => {res.setHeader('Content-Type','text/html'); res.end(fs.readFileSync(path.join(__dirname,'fixture.html')));});
 await new Promise(r => server.listen(0,'127.0.0.1',r));
 const extension = path.resolve(__dirname,'../extension');
 const profile = fs.mkdtempSync(path.join(os.tmpdir(),'cbp-test-'));
 let context;
 try {
  context = await chromium.launchPersistentContext(profile, {headless:true, channel:'chromium', executablePath:process.env.CHROMIUM_PATH, args:[`--disable-extensions-except=${extension}`,`--load-extension=${extension}`], viewport:{width:1200,height:850}});
  const worker = context.serviceWorkers()[0] || await context.waitForEvent('serviceworker');
  const id = new URL(worker.url()).host;
  const page = await context.newPage();
  const errors=[]; page.on('pageerror',e => errors.push(e.message));
  await page.goto(`http://127.0.0.1:${server.address().port}`);
  await page.waitForSelector('#cbp-page-colors', {state:'attached'});
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(await bg(), 'rgb(0, 0, 0)');
  const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.waitForSelector('[data-preset=book]');
  // The test's active tab is an extension page, so edit all-site defaults.
  await popup.selectOption('#scope','global');
  for (const [preset, expected] of Object.entries({dark:'rgb(24, 24, 24)',gray:'rgb(64, 64, 64)',light:'rgb(188, 188, 188)',white:'rgb(230, 230, 230)',book:'rgb(216, 199, 163)',black:'rgb(0, 0, 0)'})) {
   await popup.click(`[data-preset=${preset}]`);
   await page.waitForFunction(value => getComputedStyle(document.body).backgroundColor === value, expected);
  }
  await page.evaluate(() => {const el=document.createElement('div');el.id='dynamic';el.className='panel';el.textContent='Dynamically loaded question';document.body.append(el);});
  await page.waitForFunction(() => document.querySelector('#dynamic').getAttribute('data-cbp-surface') === 'surface');
  assert.equal(await page.locator('.lrn_selected').evaluate(el => getComputedStyle(el).outlineWidth),'2px');
  assert.equal(await page.locator('img').evaluate(el => getComputedStyle(el).filter),'none');
  await popup.locator('#background').evaluate(el => {el.value='#101020';el.dispatchEvent(new Event('input',{bubbles:true}));});
  await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(16, 16, 32)');
  await popup.reload(); assert.equal(await popup.inputValue('#background'),'#101020');
  await popup.uncheck('#enabled');
  await page.waitForFunction(() => !document.querySelector('#cbp-page-colors'));
  assert.equal(await bg(),'rgb(255, 255, 255)');
  assert.equal(await page.locator('[data-cbp-surface]').count(),0);
  // Site overrides and inheritance across an iframe.
  await worker.evaluate(async () => {await chrome.storage.local.set({sites:{'127.0.0.1':{enabled:true,preset:'book',paper:true}}});});
  await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(216, 199, 163)');
  await page.evaluate(() => {const f=document.createElement('iframe');f.src='/frame';f.id='embedded';document.body.append(f);});
  const frame = page.frameLocator('#embedded');
  await frame.locator('#cbp-page-colors').waitFor({state:'attached'});
  assert.equal(await frame.locator('body').evaluate(el => getComputedStyle(el).backgroundColor),'rgb(216, 199, 163)');
  await page.locator('#embedded').evaluate(el=>el.remove());
  fs.mkdirSync(path.resolve(__dirname,'../artifacts'),{recursive:true});
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/old-book-preview.png')});
  await worker.evaluate(async () => {await chrome.storage.local.set({sites:{},global:{enabled:true,preset:'black',paper:true}});});
  await page.waitForFunction(() => getComputedStyle(document.body).backgroundColor === 'rgb(0, 0, 0)');
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/black-preview.png')});
  await popup.reload(); await popup.locator('body').screenshot({path:path.resolve(__dirname,'../artifacts/popup-preview.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: real Chromium extension load; six presets; popup persistence; custom colors; dynamic content; selection; untouched images; full disable restoration; site override; iframe inheritance.');
 } finally {await context?.close(); server.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
