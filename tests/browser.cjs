const { chromium } = require('playwright');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const http = require('node:http');
const os = require('node:os');
(async () => {
 const server = http.createServer((req,res) => {res.setHeader('Content-Type','text/html'); res.end(fs.readFileSync(path.join(__dirname,'fixture.html')));});
 await new Promise(r => server.listen(0,'127.0.0.1',r));
 const extension = process.env.EXTENSION_PATH || path.resolve(__dirname,'../extension');
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
  async function loadingFrame(expected) {
    const result = await page.evaluate(async () => {
      const host = document.createElement('div'); host.className = 'lrn-assess';
      host.innerHTML = '<div class="items-loading" style="background:white;position:fixed;inset:150px 0 115px;z-index:500;display:grid;place-items:center"><span class="lrn_spinner">Loading…</span></div><div class="temporary-panel" style="background:white">Loading content</div>';
      await new Promise(resolve => requestAnimationFrame(() => { document.body.append(host); resolve(); }));
      const first = await new Promise(resolve => requestAnimationFrame(() => resolve([...host.children].map(el => getComputedStyle(el).backgroundColor))));
      host.remove();
      return first;
    });
    assert.deepEqual(result, [expected, expected], 'Loading panels must have the selected color at the first paint');
  }
  const bg = () => page.evaluate(() => getComputedStyle(document.body).backgroundColor);
  assert.equal(await bg(), 'rgb(0, 0, 0)');
  // Regression: AP Classroom injects high-specificity styles after its shell mounts.
  await page.evaluate(() => {
    document.body.id = 'quiz-shell';
    const css = document.createElement('style');
    css.textContent = `
      #quiz-shell header.bluebook-player-header, #quiz-shell footer.bluebook-player-footer {background:#e6edf8 !important;color:#222 !important;padding:18px;display:flex;justify-content:space-between;align-items:center}
      #quiz-shell .calculator-banner {background:#f5c5ce !important;color:#ddd !important;text-align:center}
      #quiz-shell .lrn-mcq-option::before {content:'•';background:white !important;color:black !important}
      #quiz-shell footer button {background:#324dc7 !important;color:white !important}
    `;
    document.head.append(css);
  });
  await page.waitForFunction(() => ['header', 'footer', '.calculator-banner', 'footer button'].every(selector => getComputedStyle(document.querySelector(selector)).backgroundColor === 'rgb(20, 20, 20)'));
  for (const selector of ['header', 'footer', '.calculator-banner', 'footer button']) {
    assert.equal(await page.locator(selector).first().evaluate(el => getComputedStyle(el).backgroundColor),'rgb(20, 20, 20)');
    assert.equal(await page.locator(selector).first().evaluate(el => getComputedStyle(el).color),'rgb(238, 238, 238)');
  }
  assert.equal(await page.locator('header svg path').evaluate(el => getComputedStyle(el).stroke),'rgb(238, 238, 238)');
  assert.equal(await page.locator('header svg path').evaluate(el => getComputedStyle(el).fill),'none');
  assert.equal(await page.locator('.lrn-mcq-option').first().evaluate(el => getComputedStyle(el,'::before').backgroundColor),'rgb(20, 20, 20)');
  const popup = await context.newPage(); await popup.goto(`chrome-extension://${id}/popup.html`);
  await popup.waitForSelector('[data-preset=book]');
  // The test's active tab is an extension page, so edit all-site defaults.
  await popup.selectOption('#scope','global');
  for (const [preset, expected] of Object.entries({dark:'rgb(24, 24, 24)',gray:'rgb(64, 64, 64)',light:'rgb(188, 188, 188)',white:'rgb(230, 230, 230)',book:'rgb(216, 199, 163)',black:'rgb(0, 0, 0)'})) {
   await popup.click(`[data-preset=${preset}]`);
   await page.waitForFunction(value => getComputedStyle(document.body).backgroundColor === value, expected);
   await loadingFrame(expected);
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
  await loadingFrame('rgb(255, 255, 255)');
  assert.equal(await page.locator('[data-cbp-surface], [data-cbp-before], [data-cbp-fill], [data-cbp-stroke]').count(),0);
  assert.equal(await page.locator('header').evaluate(el => getComputedStyle(el).backgroundColor),'rgb(230, 237, 248)');
  assert.equal(await page.locator('header svg path').evaluate(el => getComputedStyle(el).stroke),'rgb(0, 0, 0)');
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
  await page.waitForSelector('#cbp-loading-cover', {state:'detached'});
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/black-preview.png')});
  await page.evaluate(() => {
    const host = document.createElement('div'); host.className='lrn-assess';host.id='loading-proof';
    host.innerHTML='<div class="items-loading" style="background:white;position:fixed;inset:150px 0 115px;z-index:500;display:grid;place-items:center"><span class="lrn_spinner">Loading…</span></div>';document.body.append(host);
  });
  await page.waitForSelector('#cbp-loading-cover', {state:'detached'});
  await page.screenshot({path:path.resolve(__dirname,'../artifacts/loading-preview.png')});
  await page.locator('#loading-proof').evaluate(el=>el.remove());
  // Cover lifecycle: visible during a loading transition, removed after it finishes.
  await page.waitForSelector('#cbp-loading-cover', {state:'detached'});
  await page.evaluate(() => {
    const host=document.createElement('div'); host.id='cover-test';
    host.innerHTML='<div class="items-loading" style="position:fixed;inset:0;background:white">Loading</div>';
    document.body.append(host);
  });
  await page.waitForSelector('#cbp-loading-cover', {state:'attached'});
  assert.equal(await page.locator('#cbp-loading-cover').evaluate(el=>getComputedStyle(el).backgroundColor), 'rgb(0, 0, 0)');
  assert.equal(await page.locator('#cbp-loading-cover').evaluate(el=>getComputedStyle(el).pointerEvents), 'none');
  await page.locator('#cover-test').evaluate(el=>el.remove());
  await page.waitForSelector('#cbp-loading-cover', {state:'detached'});
  // Exercise the real document_start CSS on an intercepted AP Classroom origin.
  const startup=await context.newPage();
  await startup.route('https://apclassroom.collegeboard.org/**', route=>route.fulfill({contentType:'text/html',body:`<!doctype html><html><head><script>
    const root=document.documentElement;
    window.earlyCover=getComputedStyle(root,'::before').backgroundColor === 'rgb(0, 0, 0)' && getComputedStyle(root,'::before').content !== 'none' || !!document.getElementById('cbp-loading-cover');
  </script></head><body style="background:white">Startup test</body></html>`}));
  await startup.goto('https://apclassroom.collegeboard.org/cbp-startup-test');
  assert.equal(await startup.evaluate(()=>window.earlyCover),true,'A cover exists before page scripts run');
  await startup.waitForSelector('#cbp-loading-cover', {state:'detached'});
  assert.equal(await startup.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(0, 0, 0)');
  await worker.evaluate(()=>chrome.storage.local.set({global:{enabled:false,preset:'black'}}));
  await startup.waitForFunction(()=>!document.querySelector('#cbp-page-colors'));
  assert.equal(await startup.locator('#cbp-loading-cover').count(),0);
  assert.equal(await startup.locator('body').evaluate(el=>getComputedStyle(el).backgroundColor),'rgb(255, 255, 255)');
  assert.equal(await startup.evaluate(()=>getComputedStyle(document.documentElement,'::before').content),'none');
  await startup.close();
  await worker.evaluate(()=>chrome.storage.local.set({global:{enabled:true,preset:'black'}}));
  await popup.reload(); await popup.locator('body').screenshot({path:path.resolve(__dirname,'../artifacts/popup-preview.png')});
  assert.deepEqual(errors,[]);
  console.log('PASS: real Chromium extension load; six presets; popup persistence; custom colors; dynamic content; selection; untouched images; full disable restoration; site override; iframe inheritance; late stylesheet injection; high-specificity header/footer/banner colors; pseudo-elements; neutral toolbar SVG contrast and restoration; first-frame loading colors across all six presets and disabled mode; document-start cover; transition cover removal; disabled cover cleanup.');
 } finally {await context?.close(); server.close();fs.rmSync(profile,{recursive:true,force:true});}
})().catch(e=>{console.error(e);process.exitCode=1;});
