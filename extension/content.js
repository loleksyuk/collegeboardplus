(() => {
  let cover, coverTimeout, uncoverFrame, loading = false;
  function reveal() {
    cancelAnimationFrame(uncoverFrame);
    clearTimeout(coverTimeout);
    cover?.remove(); cover = null;
    document.documentElement.setAttribute('data-cbp-ready', '');
  }
  function protect() {
    if (cover || !settings?.enabled) return;
    cover = document.createElement('div');
    cover.id = 'cbp-loading-cover';
    cover.setAttribute('aria-hidden', 'true');
    cover.style.cssText = `position:fixed!important;inset:0!important;z-index:2147483647!important;background:${settings.palette.background}!important;pointer-events:none!important;`;
    document.documentElement.append(cover);
    // Never strand the user behind a cover if the page fails to finish loading.
    coverTimeout = setTimeout(reveal, 1500);
  }
  function revealAfterPaint() {
    cancelAnimationFrame(uncoverFrame);
    uncoverFrame = requestAnimationFrame(() => {
      uncoverFrame = requestAnimationFrame(reveal);
    });
  }
  const attribute = 'data-cbp-surface';
  let style, observer, timer, settings, storage = {}, site = location.hostname;
  // In embedded quizzes, use the outer site's preference whenever Chrome exposes it.
  try { site = new URL(location.ancestorOrigins?.[location.ancestorOrigins.length - 1] || location.href).hostname; } catch {}
  // Learnosity is shared by many services. Only theme its frames when the
  // outermost page belongs to College Board, never unrelated customers.
  if (!PageColors.isCollegeBoard(site)) return;
  const pending = new Set();
  const priority = ':root:not(#cbp-unused-1):not(#cbp-unused-2):not(#cbp-unused-3)';
  const excluded = 'img, video, canvas, svg, svg *, picture, iframe, object, embed';
  function stylesheet(s) {
    const p = s.palette;
    const dark = PageColors.luminance(p.background) < .3;
    return `
      ${priority} { color-scheme: ${dark ? 'dark' : 'light'} !important; background-color: ${p.background} !important; }
      ${priority} body:not(#cbp-unused-4) { background-color: ${p.background} !important; }
      ${priority} *:not(:where(${excluded})) { color: ${p.text} !important; border-color: ${p.border} !important; text-shadow: none !important; }
      ${priority} [${attribute}="base"] { background-color: ${p.background} !important; }
      ${priority} [${attribute}="surface"] { background-color: ${p.surface} !important; }
      ${priority} [${attribute}] { box-shadow: none !important; }
      ${priority} [data-cbp-gradient] { background-image: none !important; }
      input:not([type=radio]):not([type=checkbox]), textarea, select, [contenteditable=true] { background-color: ${p.surface} !important; caret-color: ${p.text} !important; }
      ${priority} :is(.lrn-assess .items-loading, .lrn-loader, .lrn-customfeature-loader, .lrn-image-load-error-spinner-container) {
        background-color: ${p.background} !important; color: ${p.text} !important;
      }
      ${priority} :is(.spinner-border, .lds-spinner-border) { border-color: ${p.text} !important; border-right-color: transparent !important; }
      ${priority} .lrn_spinner > [class^="lrn_bounce"] { background-color: ${p.text} !important; }
      input, progress { accent-color: ${p.text} !important; }
      a { text-decoration-color: currentColor !important; }
      a:hover { text-decoration: underline !important; }
      button:hover, [role=button]:hover, .lrn-mcq-option:hover { outline: 1px solid ${p.border} !important; outline-offset: -1px; }
      :focus-visible { outline: 2px solid ${p.text} !important; outline-offset: 2px !important; }
      ${priority} :is([aria-selected=true], [aria-checked=true], .lrn-mcq-option.lrn_selected, .lrn-mcq-option:has(input:checked)) { background-color: ${p.surface} !important; outline: 2px solid ${p.text} !important; outline-offset: -2px !important; }
      ${priority} :is(.lrn-mcq-option.lrn_correct, .lrn-mcq-option.lrn_valid):not(#cbp-unused-4) { outline: 2px solid ${dark ? '#74d99a' : '#176635'} !important; }
      ${priority} :is(.lrn-mcq-option.lrn_incorrect, .lrn-mcq-option.lrn_invalid):not(#cbp-unused-4) { outline: 2px solid ${dark ? '#ff9999' : '#9e2525'} !important; }
      ${priority} *:not(:where(${excluded}))::before, ${priority} *:not(:where(${excluded}))::after { color: ${p.text} !important; border-color: ${p.border} !important; }
      ${priority} [data-cbp-before]::before, ${priority} [data-cbp-after]::after { background-color: ${p.surface} !important; }
      ${priority} [data-cbp-fill] { fill: ${p.text} !important; }
      ${priority} [data-cbp-stroke] { stroke: ${p.text} !important; }
      ::placeholder { color: ${p.text} !important; opacity: .6 !important; }
      ::selection { background: ${p.text} !important; color: ${p.background} !important; }
      :disabled, [aria-disabled=true] { opacity: .55 !important; }
      ${s.paper ? '.lrn img, .lrn canvas, .lrn_widget img, .lrn_widget canvas { background-color: white !important; }' : ''}
    `;
  }
  function scan() {
    timer = null;
    if (!style?.isConnected) return;
    // Read original styles in one batch, then apply colors without inverting media.
    style.disabled = true;
    const elements = new Set();
    for (const root of pending) {
      if (!root.isConnected) continue;
      elements.add(root);
      root.querySelectorAll('*').forEach(el => elements.add(el));
    }
    pending.clear();
    const updates = [];
    for (const el of elements) {
      if (el instanceof SVGElement) {
        if (el.closest('button, [role="button"], header, footer, [class*="bluebook-player-header"], [class*="bluebook-player-footer"]')) {
          const icon = getComputedStyle(el);
          for (const prop of ['fill', 'stroke']) {
            const rgb = icon[prop].match(/[\d.]+/g)?.map(Number) || [];
            const neutral = rgb.length >= 3 && Math.max(...rgb.slice(0, 3)) - Math.min(...rgb.slice(0, 3)) < 15 && (rgb.length < 4 || rgb[3] > 0);
            el.toggleAttribute(`data-cbp-${prop}`, neutral);
          }
        }
        continue;
      }
      if (!(el instanceof HTMLElement) || el === style || el === cover || el.matches(excluded)) continue;
      for (const pseudo of ['before', 'after']) {
        const decoration = getComputedStyle(el, `::${pseudo}`);
        const rgba = decoration.backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
        const painted = !['none', 'normal'].includes(decoration.content) && rgba.length >= 3 && (rgba.length < 4 || rgba[3] > .05);
        el.toggleAttribute(`data-cbp-${pseudo}`, painted);
      }
      const css = getComputedStyle(el);
      const values = css.backgroundColor.match(/[\d.]+/g)?.map(Number) || [];
      const opaque = values.length >= 3 && (values.length < 4 || values[3] > .05);
      const gradient = /gradient\(/.test(css.backgroundImage);
      let tone = null;
      if (opaque || gradient) {
        const light = values.length >= 3 ? .2126 * values[0] + .7152 * values[1] + .0722 * values[2] : 255;
        tone = light > 245 ? 'base' : 'surface';
      }
      updates.push([el, tone, gradient && !/url\(/.test(css.backgroundImage)]);
    }
    for (const [el, tone, gradient] of updates) {
      el.toggleAttribute('data-cbp-gradient', gradient);
      if (tone) el.setAttribute(attribute, tone);
      else el.removeAttribute(attribute);
    }
    style.disabled = false;
    const loadingNow = [...document.querySelectorAll('.items-loading, .lrn-loader, .lrn-customfeature-loader')].some(el => {
      const css = getComputedStyle(el), rect = el.getBoundingClientRect();
      return css.visibility !== 'hidden' && css.display !== 'none' && Number(css.opacity) > 0 && rect.width * rect.height > innerWidth * innerHeight / 4;
    });
    if (loadingNow && !loading) { protect(); cancelAnimationFrame(uncoverFrame); }
    loading = loadingNow;
    if (!loading && document.readyState !== 'loading') revealAfterPaint();
  }
  function queue(root) {
    if (!(root instanceof Element) || root === style || root === cover) return;
    pending.add(root);
    // Mutation observers and this microtask run before paint. A timeout lets
    // newly inserted white panels remain visible for several frames.
    if (!timer) {
      timer = true;
      queueMicrotask(() => { if (timer) scan(); });
    }
  }
  function stop() {
    observer?.disconnect(); observer = null;
    reveal(); loading = false;
    timer = null; pending.clear();
    style?.remove(); style = null;
    const attrs = [attribute, 'data-cbp-gradient', 'data-cbp-before', 'data-cbp-after', 'data-cbp-fill', 'data-cbp-stroke'];
    document.querySelectorAll(attrs.map(a => `[${a}]`).join(',')).forEach(el => attrs.forEach(a => el.removeAttribute(a)));
  }
  function apply() {
    settings = PageColors.resolve(storage.sites?.[site] || storage.global);
    stop();
    if (!settings.enabled) return;
    protect();
    style = document.createElement('style');
    style.id = 'cbp-page-colors';
    style.textContent = stylesheet(settings);
    document.documentElement.append(style);
    pending.add(document.documentElement); scan();
    observer = new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'attributes') queue(r.target);
        else {
          if ([...r.removedNodes].some(node => !(node instanceof Element) || !node.id?.startsWith('cbp-'))) queue(r.target);
          r.addedNodes.forEach(node => {
            queue(node);
            if (node instanceof Element && (node.matches('style, link[rel="stylesheet"]') || node.querySelector('style, link[rel="stylesheet"]'))) queue(document.documentElement);
          });
          if (r.target instanceof HTMLStyleElement && r.target !== style) queue(document.documentElement);
        }
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'checked', 'aria-checked', 'aria-selected'] });
  }
  async function start() {
    try { storage = await chrome.storage.local.get(['global', 'sites']); } catch { reveal(); return; }
    apply();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const key of ['global', 'sites']) if (changes[key]) storage[key] = changes[key].newValue;
      apply();
    });
    document.addEventListener('DOMContentLoaded', () => { if (style) queue(document.documentElement); }, { once: true });
    document.addEventListener('load', event => { if (event.target instanceof HTMLLinkElement && style) queue(document.documentElement); }, true);
  }
  if (document.documentElement) start();
  else new MutationObserver(function (_, obs) { if (document.documentElement) { obs.disconnect(); start(); } }).observe(document, { childList: true });
})();
