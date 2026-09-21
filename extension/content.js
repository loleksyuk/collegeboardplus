(() => {
  const attribute = 'data-cbp-surface';
  let style, observer, timer, settings, storage = {}, site = location.hostname;
  // In embedded quizzes, use the outer site's preference whenever Chrome exposes it.
  try { site = new URL(location.ancestorOrigins?.[location.ancestorOrigins.length - 1] || location.href).hostname; } catch {}
  const pending = new Set();
  const excluded = 'img, video, canvas, svg, svg *, picture, iframe, object, embed';
  function stylesheet(s) {
    const p = s.palette;
    const dark = PageColors.luminance(p.background) < .3;
    return `
      :root { color-scheme: ${dark ? 'dark' : 'light'} !important; background-color: ${p.background} !important; }
      html body { background-color: ${p.background} !important; }
      *:not(:where(${excluded})) { color: ${p.text} !important; border-color: ${p.border} !important; text-shadow: none !important; }
      [${attribute}="base"] { background-color: ${p.background} !important; }
      [${attribute}="surface"] { background-color: ${p.surface} !important; }
      [${attribute}] { box-shadow: none !important; }
      [data-cbp-gradient] { background-image: none !important; }
      input:not([type=radio]):not([type=checkbox]), textarea, select, [contenteditable=true] { background-color: ${p.surface} !important; caret-color: ${p.text} !important; }
      input, progress { accent-color: ${p.text} !important; }
      a { text-decoration-color: currentColor !important; }
      a:hover { text-decoration: underline !important; }
      button:hover, [role=button]:hover, .lrn-mcq-option:hover { outline: 1px solid ${p.border} !important; outline-offset: -1px; }
      :focus-visible { outline: 2px solid ${p.text} !important; outline-offset: 2px !important; }
      [aria-selected=true], [aria-checked=true], .lrn-mcq-option.lrn_selected, .lrn-mcq-option:has(input:checked) { background-color: ${p.surface} !important; outline: 2px solid ${p.text} !important; outline-offset: -2px !important; }
      .lrn-mcq-option.lrn_correct, .lrn-mcq-option.lrn_valid { outline: 2px solid ${dark ? '#74d99a' : '#176635'} !important; }
      .lrn-mcq-option.lrn_incorrect, .lrn-mcq-option.lrn_invalid { outline: 2px solid ${dark ? '#ff9999' : '#9e2525'} !important; }
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
      if (!(el instanceof HTMLElement) || el === style || el.matches(excluded)) continue;
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
  }
  function queue(root) {
    if (!(root instanceof Element) || root === style) return;
    pending.add(root);
    if (!timer) timer = setTimeout(scan, 60);
  }
  function stop() {
    observer?.disconnect(); observer = null;
    clearTimeout(timer); timer = null; pending.clear();
    style?.remove(); style = null;
    document.querySelectorAll(`[${attribute}], [data-cbp-gradient]`).forEach(el => { el.removeAttribute(attribute); el.removeAttribute('data-cbp-gradient'); });
  }
  function apply() {
    settings = PageColors.resolve(storage.sites?.[site] || storage.global);
    stop();
    if (!settings.enabled) return;
    style = document.createElement('style');
    style.id = 'cbp-page-colors';
    style.textContent = stylesheet(settings);
    document.documentElement.append(style);
    pending.add(document.documentElement); scan();
    observer = new MutationObserver(records => {
      for (const r of records) {
        if (r.type === 'attributes') queue(r.target);
        else {
          r.addedNodes.forEach(queue);
          if (r.target instanceof HTMLStyleElement && r.target !== style) queue(document.documentElement);
        }
      }
    });
    observer.observe(document.documentElement, { subtree: true, childList: true, attributes: true, attributeFilter: ['class', 'style', 'checked', 'aria-checked', 'aria-selected'] });
  }
  async function start() {
    storage = await chrome.storage.local.get(['global', 'sites']);
    apply();
    chrome.storage.onChanged.addListener((changes, area) => {
      if (area !== 'local') return;
      for (const key of ['global', 'sites']) if (changes[key]) storage[key] = changes[key].newValue;
      apply();
    });
    document.addEventListener('load', event => { if (event.target instanceof HTMLLinkElement && style) queue(document.documentElement); }, true);
  }
  if (document.documentElement) start();
  else new MutationObserver(function (_, obs) { if (document.documentElement) { obs.disconnect(); start(); } }).observe(document, { childList: true });
})();
