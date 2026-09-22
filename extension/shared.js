(() => {
  const presets = {
    black: { name: 'Pure black', background: '#000000', surface: '#141414', text: '#eeeeee', border: '#555555' },
    dark: { name: 'Dark gray', background: '#181818', surface: '#252525', text: '#eeeeee', border: '#626262' },
    gray: { name: 'Gray', background: '#404040', surface: '#4b4b4b', text: '#ffffff', border: '#909090' },
    light: { name: 'Light gray', background: '#bcbcbc', surface: '#d0d0d0', text: '#151515', border: '#666666' },
    white: { name: 'Dark white', background: '#e6e6e6', surface: '#f2f2f2', text: '#171717', border: '#777777' },
    book: { name: 'Old book', background: '#d8c7a3', surface: '#e5d6b8', text: '#30291f', border: '#87765b' }
  };
  const defaults = { enabled: true, preset: 'black', custom: null, paper: true };
  const validColor = value => /^#[0-9a-f]{6}$/i.test(value || '');
  function resolve(settings = {}) {
    const s = { ...defaults, ...settings };
    if (!presets[s.preset]) s.preset = 'black';
    const palette = { ...presets[s.preset] };
    if (s.custom) for (const key of ['background', 'surface', 'text', 'border']) {
      if (validColor(s.custom[key])) palette[key] = s.custom[key];
    }
    return { ...s, palette };
  }
  function luminance(hex) {
    const rgb = hex.slice(1).match(/../g).map(x => parseInt(x, 16) / 255).map(x => x <= .04045 ? x / 12.92 : ((x + .055) / 1.055) ** 2.4);
    return .2126 * rgb[0] + .7152 * rgb[1] + .0722 * rgb[2];
  }
  function contrast(a, b) { const x = luminance(a), y = luminance(b); return (Math.max(x, y) + .05) / (Math.min(x, y) + .05); }
  const isCollegeBoard = host => host === 'collegeboard.org' || host.endsWith('.collegeboard.org');
  globalThis.PageColors = { isCollegeBoard, presets, defaults, resolve, luminance, contrast };
})();
