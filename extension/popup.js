(async () => {
  const $ = id => document.getElementById(id);
  const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
  let host = '';
  try { if (/^https?:/.test(tab?.url)) host = new URL(tab.url).hostname; } catch {}
  let data = await chrome.storage.local.get(['global', 'sites']);
  let current;
  if (!PageColors.isCollegeBoard(host)) { host = '';  $('scope').value = 'global'; $('scope').options[0].disabled = true; }
  $('site').textContent = host || 'Inactive here. Open a College Board website to use CollegeBoard+.';
  for (const [id, p] of Object.entries(PageColors.presets)) {
    const button = document.createElement('button');
    button.type = 'button'; button.dataset.preset = id;
    const swatch = document.createElement('span'); swatch.className = 'swatch'; swatch.style.background = p.background || '#fff';
    button.append(swatch, document.createTextNode(p.name));
    button.addEventListener('click', () => { current.preset = id; current.custom = null; current.enabled = true; save(); });
    $('presets').append(button);
  }
  function render() {
    const resolved = PageColors.resolve(current), p = resolved.palette;
    $('enabled').checked = resolved.enabled; $('paper').checked = resolved.paper;
    document.querySelectorAll('[data-preset]').forEach(el => el.setAttribute('aria-pressed', String(el.dataset.preset === resolved.preset)));
    const original = false;
    $('custom').hidden = original; $('preview').hidden = original;
    if (!original) {
      for (const key of ['background', 'surface', 'text', 'border']) $(key).value = p[key];
      const ratio = Math.min(PageColors.contrast(p.background, p.text), PageColors.contrast(p.surface, p.text));
      $('contrast').textContent = `Text contrast ${ratio.toFixed(1)}:1${ratio < 4.5 ? ' — low; adjust text or backgrounds' : ' · readable'}`;
      $('preview').style.cssText = `background:${p.background};color:${p.text};border-color:${p.border}`;
      $('preview').querySelector('span').style.cssText = `background:${p.surface};border-color:${p.border}`;
    }
    $('reset').textContent = $('scope').value === 'site' ? 'Use website defaults' : 'Reset supported-site default';
  }
  function load() { current = { ...PageColors.defaults, ...($('scope').value === 'site' ? data.sites?.[host] || data.global : data.global) }; render(); }
  let saving = Promise.resolve();
  function save() {
    const value = structuredClone(current), scope = $('scope').value;
    render(); $('status').textContent = 'Saving…';
    saving = saving.then(async () => {
      if (scope === 'site') {
        const fresh = await chrome.storage.local.get('sites');
        data.sites = { ...fresh.sites, [host]: value };
        await chrome.storage.local.set({ sites: data.sites });
      } else { data.global = value; await chrome.storage.local.set({ global: value }); }
      $('status').textContent = 'Saved';
    }).catch(() => { $('status').textContent = 'Could not save. Retry.'; });
  }
  $('scope').addEventListener('change', load);
  $('enabled').addEventListener('change', () => { current.enabled = $('enabled').checked; save(); });
  $('paper').addEventListener('change', () => { current.paper = $('paper').checked; save(); });
  for (const key of ['background', 'surface', 'text', 'border']) $(key).addEventListener('input', () => {
    current.custom = { ...current.custom, [key]: $(key).value }; save();
  });
  $('reset').addEventListener('click', async () => {
    await saving;
    try {
      if ($('scope').value === 'site') {
        const fresh = await chrome.storage.local.get('sites'); data.sites = { ...fresh.sites }; delete data.sites[host];
        await chrome.storage.local.set({ sites: data.sites });
      } else { data.global = { ...PageColors.defaults }; await chrome.storage.local.set({ global: data.global }); }
      load(); $('status').textContent = 'Reset';
    } catch { $('status').textContent = 'Could not reset. Retry.'; }
  });
  load();
})();
