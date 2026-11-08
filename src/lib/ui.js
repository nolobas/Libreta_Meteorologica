// Utilidades de interfaz: creación de elementos, íconos, diálogos, avisos y gráficos.

export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k === 'class') el.className = v;
    else if (k === 'style' && typeof v === 'object') Object.assign(el.style, v);
    else if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'html') el.innerHTML = v;
    else if (k === 'value') el.value = v;
    else if (k === 'checked') el.checked = !!v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

const P = {
  home: 'M10 2.5 2.5 8.6V17a.5.5 0 0 0 .5.5h4.5v-5h5v5H17a.5.5 0 0 0 .5-.5V8.6z',
  book: 'M4 3.5A1.5 1.5 0 0 1 5.5 2H16v13H5.5a1.5 1.5 0 0 0 0 3H16M7 6h6M7 9h4',
  chart: 'M3 17h14M5 14V9M9 14V5M13 14v-3M17 14V7',
  gauge: 'M3.5 14a7 7 0 1 1 13 0M10 14l3.5-5M10 15.2a1.2 1.2 0 1 0 0-2.4 1.2 1.2 0 0 0 0 2.4z',
  station: 'M10 2v16M6 18h8M10 5l5 3-5 3M10 5 5 3',
  tune: 'M3 6h8M15 6h2M3 14h2M9 14h8M13 4v4M7 12v4',
  shield: 'M10 2 3.5 4.5v5c0 4 3 6.8 6.5 8.5 3.5-1.7 6.5-4.5 6.5-8.5v-5z',
  folder: 'M2.5 5.5A1.5 1.5 0 0 1 4 4h4l2 2h6a1.5 1.5 0 0 1 1.5 1.5v7A1.5 1.5 0 0 1 16 16H4a1.5 1.5 0 0 1-1.5-1.5z',
  save: 'M4 3h10l3 3v10a1 1 0 0 1-1 1H4a1 1 0 0 1-1-1V4a1 1 0 0 1 1-1zM6 3v4h7V3M6 17v-5h8v5',
  check: 'M4 10.5 8 14.5 16 6',
  warn: 'M10 3 2 17h16zM10 8v4M10 14.5v.5',
  err: 'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM7.5 7.5l5 5M12.5 7.5l-5 5',
  info: 'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM10 9v5M10 6.5v.5',
  copy: 'M7 7h9v10H7zM4 13V3h9',
  print: 'M5 8V3h10v5M5 14H3V8h14v6h-2M5 11h10v6H5z',
  left: 'M12.5 4 6.5 10l6 6',
  right: 'M7.5 4l6 6-6 6',
  plus: 'M10 4v12M4 10h12',
  trash: 'M4 6h12M8 6V4h4v2M5.5 6l1 11h7l1-11',
  download: 'M10 3v10M6 9l4 4 4-4M4 16h12',
  upload: 'M10 15V5M6 9l4-4 4 4M4 17h12',
  search: 'M8.5 3a5.5 5.5 0 1 0 0 11 5.5 5.5 0 0 0 0-11zM12.5 12.5 17 17',
  thermo: 'M8 11.5V4a2 2 0 1 1 4 0v7.5a3.5 3.5 0 1 1-4 0zM10 8v6',
  drop: 'M10 2.5s-5.5 6-5.5 9.5a5.5 5.5 0 0 0 11 0C15.5 8.5 10 2.5 10 2.5z',
  wind: 'M3 8h9.5a2.5 2.5 0 1 0-2.5-2.5M3 12h12a2.5 2.5 0 1 1-2.5 2.5M3 16h5',
  cloud: 'M6 16a4 4 0 0 1-.5-8 5 5 0 0 1 9.6 1.5A3.3 3.3 0 0 1 14.5 16z',
  eye: 'M2 10s3-5.5 8-5.5S18 10 18 10s-3 5.5-8 5.5S2 10 2 10zM10 12.5a2.5 2.5 0 1 0 0-5 2.5 2.5 0 0 0 0 5z',
  rain: 'M6 12a4 4 0 0 1-.5-8 5 5 0 0 1 9.6 1.5A3.3 3.3 0 0 1 14.5 12zM7 14.5 6 17M10.5 14.5l-1 2.5M14 14.5 13 17',
  sun: 'M10 6.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7zM10 2v2M10 16v2M2 10h2M16 10h2M4.3 4.3l1.4 1.4M14.3 14.3l1.4 1.4M4.3 15.7l1.4-1.4M14.3 5.7l1.4-1.4',
  pressure: 'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM10 10l3-4M6 13h8',
  code: 'M7 6 3 10l4 4M13 6l4 4-4 4',
  calendar: 'M3.5 5h13v11.5h-13zM3.5 8.5h13M7 3v3M13 3v3',
  clock: 'M10 2.5a7.5 7.5 0 1 0 0 15 7.5 7.5 0 0 0 0-15zM10 6v4l2.5 2.5',
  lock: 'M5 9h10v8H5zM7 9V6.5a3 3 0 0 1 6 0V9',
  refresh: 'M16 10a6 6 0 1 1-1.8-4.3M16 3.5v3.5h-3.5',
  archive: 'M3 4h14v3H3zM4 7v9h12V7M8 10h4',
  ground: 'M2 14h16M4 14l2-3h8l2 3M5 17h10',
  list: 'M7 5h10M7 10h10M7 15h10M3.5 5h.5M3.5 10h.5M3.5 15h.5',
  edit: 'M13.5 3.5l3 3L7 16H4v-3z',
};
export function icon(name, extra = '') {
  const s = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
  s.setAttribute('viewBox', '0 0 20 20'); s.setAttribute('fill', 'none'); s.setAttribute('stroke', 'currentColor');
  s.setAttribute('stroke-width', '1.4'); s.setAttribute('stroke-linecap', 'round'); s.setAttribute('stroke-linejoin', 'round');
  if (extra) s.setAttribute('class', extra);
  const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
  p.setAttribute('d', P[name] || P.info); s.append(p);
  return s;
}

export function toast(msg, kind = 'ok', ms = 3500) {
  let box = document.querySelector('.toasts');
  if (!box) { box = h('div', { class: 'toasts' }); document.body.append(box); }
  const t = h('div', { class: `toast ${kind}` }, icon(kind === 'err' ? 'err' : kind === 'info' ? 'info' : 'check'), h('div', {}, msg));
  box.append(t);
  setTimeout(() => t.remove(), ms);
}

/** Diálogo modal. buttons: [{label, value, primary, danger}] → Promise(value) */
export function dialog({ title, body, buttons = [{ label: 'Aceptar', value: true, primary: true }], width }) {
  return new Promise((resolve) => {
    const close = (v) => { ov.remove(); document.removeEventListener('keydown', onKey); resolve(v); };
    const onKey = (e) => { if (e.key === 'Escape') close(null); };
    const content = typeof body === 'string' ? h('div', { class: 'muted', html: body }) : body;
    const dlg = h('div', { class: 'dialog', style: width ? { width } : null },
      h('div', { class: 'body' }, h('h2', {}, title), content),
      h('div', { class: 'foot' }, buttons.map((b) => h('button', {
        class: `btn ${b.primary ? 'primary' : ''} ${b.danger ? 'danger' : ''}`, onclick: () => close(typeof b.value === 'function' ? b.value() : b.value),
      }, b.label))));
    const ov = h('div', { class: 'overlay', onmousedown: (e) => { if (e.target === ov) close(null); } }, dlg);
    document.body.append(ov);
    document.addEventListener('keydown', onKey);
    const f = dlg.querySelector('input, .btn.primary'); if (f) setTimeout(() => f.focus(), 30);
  });
}
export const confirmDlg = (title, body, ok = 'Aceptar', danger = false) =>
  dialog({ title, body, buttons: [{ label: 'Cancelar', value: false }, { label: ok, value: true, primary: !danger, danger }] });

export async function askPassword(expected, what = 'esta sección') {
  if (!expected) return true;
  const inp = h('input', { class: 'inp', type: 'password', autocomplete: 'off' });
  const body = h('div', {}, h('p', { class: 'muted' }, `Ingrese la clave de acceso para entrar a ${what}.`), inp);
  inp.addEventListener('keydown', (e) => { if (e.key === 'Enter') body.closest('.dialog').querySelector('.btn.primary').click(); });
  const r = await dialog({ title: 'Clave de acceso', body, buttons: [{ label: 'Cancelar', value: null }, { label: 'Entrar', value: () => inp.value, primary: true }] });
  if (r == null) return false;
  if (r !== expected) { toast('Clave no autorizada', 'err'); return false; }
  return true;
}

// ------------------------------------------------------------------ campos de formulario
export function field(label, control, help) {
  return h('div', { class: 'field' }, h('label', {}, label), control, help ? h('div', { class: 'help' }, help) : null);
}
export function numInput(value, { unit, step = '0.1', placeholder = '', oninput, width } = {}) {
  const inp = h('input', { class: 'inp num', type: 'text', inputmode: 'decimal', value: value ?? '', placeholder, style: width ? { width } : null });
  inp.addEventListener('input', () => { inp.value = inp.value.replace(',', '.'); oninput && oninput(inp.value); });
  inp.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') { e.preventDefault(); focusNext(inp); }
    if (e.key === 'ArrowUp' || e.key === 'ArrowDown') {
      e.preventDefault(); const st = Number(step); const v = Number(inp.value || 0) + (e.key === 'ArrowUp' ? st : -st);
      inp.value = Number(v.toFixed(3)).toString(); inp.dispatchEvent(new Event('input'));
    }
  });
  if (!unit) return inp;
  const w = h('div', { class: 'unit-wrap' }, inp, h('span', { class: 'u' }, unit));
  w.input = inp;
  return w;
}
export function focusNext(el) {
  const all = [...document.querySelectorAll('main input:not([disabled]):not([type=checkbox]):not([type=radio]), main select:not([disabled])')]
    .filter((x) => x.offsetParent !== null);
  const i = all.indexOf(el);
  if (i >= 0 && all[i + 1]) all[i + 1].focus();
}
export function select(options, value, onchange, { empty = '—', cls = '' } = {}) {
  const s = h('select', { class: `inp ${cls}` });
  if (empty !== null) s.append(h('option', { value: '' }, empty));
  for (const o of options) {
    const [v, t] = Array.isArray(o) ? o : [o.value, o.label];
    s.append(h('option', { value: v }, t));
  }
  s.value = value == null ? '' : String(value);
  s.addEventListener('change', () => onchange && onchange(s.value));
  s.addEventListener('keydown', (e) => { if (e.key === 'Enter') { e.preventDefault(); focusNext(s); } });
  return s;
}
export function codeOptions(arr, from = 0) { return arr.map((t, i) => [String(i + from), `${i + from} — ${t}`]); }

export function card(title, iconName, ...children) {
  return h('section', { class: 'card' },
    title ? h('div', { class: 'card-title' }, iconName ? h('div', { class: 'ic' }, icon(iconName)) : null, h('h3', {}, title)) : null,
    ...children);
}
export function alertBox(kind, text) {
  return h('div', { class: `alert ${kind}` }, icon(kind === 'err' ? 'err' : kind === 'warn' ? 'warn' : kind === 'ok' ? 'check' : 'info'), h('div', {}, text));
}

// ------------------------------------------------------------------ gráfico de líneas / barras (SVG)
/**
 * lineChart({ labels, series:[{name, values, color, unit, kind:'line'|'bar'}], height, yFmt })
 * Un solo eje Y. Con 2+ series se muestra la leyenda.
 */
export function lineChart({ labels, series, height = 200, yFmt = (v) => v.toFixed(1).replace('.', ','), unit = '', zero = false, width = 520 }) {
  const W = width; const H = height; const m = { l: 40, r: 12, t: 10, b: 24 };
  const all = series.flatMap((s) => s.values).filter((v) => v != null && !Number.isNaN(v));
  const wrap = h('div', { class: 'chart' });
  if (series.length > 1) {
    wrap.append(h('div', { class: 'chart-legend' }, series.map((s) => h('span', {}, h('i', { style: { background: s.color } }), s.name))));
  }
  if (!all.length) { wrap.append(h('div', { class: 'empty small' }, 'Sin datos para graficar')); return wrap; }
  let lo = Math.min(...all); let hi = Math.max(...all);
  if (zero) lo = Math.min(0, lo);
  if (hi - lo < 1) { hi += 0.5; lo -= 0.5; }
  const span = hi - lo; const stepRaw = span / 4; const mag = 10 ** Math.floor(Math.log10(stepRaw));
  const step = [1, 2, 2.5, 5, 10].map((x) => x * mag).find((x) => x >= stepRaw);
  lo = Math.floor(lo / step) * step; hi = Math.ceil(hi / step) * step;
  const n = labels.length; const iw = W - m.l - m.r; const ih = H - m.t - m.b;
  const x = (i) => m.l + (n <= 1 ? iw / 2 : (i * iw) / (n - 1));
  const bw = Math.max(3, Math.min(18, iw / n - 4));
  const xb = (i) => m.l + ((i + 0.5) * iw) / n;
  const hasBar = series.some((s) => s.kind === 'bar');
  const X = hasBar ? xb : x;
  const y = (v) => m.t + ih - ((v - lo) / (hi - lo)) * ih;
  const ns = 'http://www.w3.org/2000/svg';
  const svg = document.createElementNS(ns, 'svg'); svg.setAttribute('viewBox', `0 0 ${W} ${H}`);
  const add = (tag, at, txt) => { const e = document.createElementNS(ns, tag); for (const [k, v] of Object.entries(at)) e.setAttribute(k, v); if (txt != null) e.textContent = txt; svg.append(e); return e; };
  for (let v = lo; v <= hi + 1e-9; v += step) {
    add('line', { x1: m.l, x2: W - m.r, y1: y(v), y2: y(v), class: 'gl' });
    add('text', { x: m.l - 6, y: y(v) + 4, 'text-anchor': 'end', class: 'ax' }, step < 1 ? v.toFixed(1).replace('.', ',') : Math.round(v).toString());
  }
  const every = Math.ceil(n / 12);
  labels.forEach((lb, i) => { if (i % every === 0) add('text', { x: X(i), y: H - 6, 'text-anchor': 'middle', class: 'ax' }, lb); });
  for (const s of series) {
    if (s.kind === 'bar') {
      s.values.forEach((v, i) => {
        if (v == null || v <= 0) return;
        const top = y(v); const base = y(Math.max(lo, 0)); const hgt = Math.max(1, base - top);
        add('path', { d: roundTop(X(i) - bw / 2, top, bw, hgt, Math.min(4, bw / 2)), fill: s.color });
      });
    } else {
      let d = ''; let pen = false;
      s.values.forEach((v, i) => {
        if (v == null || Number.isNaN(v)) { pen = false; return; }
        d += `${pen ? 'L' : 'M'}${X(i).toFixed(1)},${y(v).toFixed(1)}`; pen = true;
      });
      add('path', { d, class: 'ln', stroke: s.color });
      s.values.forEach((v, i) => {
        const prev = s.values[i - 1]; const next = s.values[i + 1];
        if (v != null && (prev == null) && (next == null)) add('circle', { cx: X(i), cy: y(v), r: 3, fill: s.color });
      });
    }
  }
  const xh = add('line', { y1: m.t, y2: m.t + ih, class: 'xh', visibility: 'hidden' });
  const dots = series.map((s) => (s.kind === 'bar' ? null : add('circle', { r: 4, fill: s.color, stroke: 'var(--card)', 'stroke-width': 2, visibility: 'hidden' })));
  const hit = add('rect', { x: m.l, y: m.t, width: iw, height: ih, fill: 'transparent' });
  const tip = h('div', { class: 'tip' });
  wrap.append(svg, tip);
  hit.addEventListener('mousemove', (ev) => {
    const r = svg.getBoundingClientRect(); const px = ((ev.clientX - r.left) / r.width) * W;
    let i = hasBar ? Math.floor(((px - m.l) / iw) * n) : Math.round(((px - m.l) / iw) * (n - 1));
    i = Math.max(0, Math.min(n - 1, i));
    xh.setAttribute('x1', X(i)); xh.setAttribute('x2', X(i)); xh.setAttribute('visibility', 'visible');
    tip.replaceChildren(h('div', { class: 'muted' }, labels[i]), ...series.map((s) => h('div', {},
      series.length > 1 ? `${s.name}: ` : '', h('b', {}, s.values[i] == null ? 's/d' : `${yFmt(s.values[i])}${s.unit ?? unit}`))));
    series.forEach((s, k) => { const d = dots[k]; if (!d) return; const v = s.values[i]; if (v == null) d.setAttribute('visibility', 'hidden'); else { d.setAttribute('cx', X(i)); d.setAttribute('cy', y(v)); d.setAttribute('visibility', 'visible'); } });
    const ys = series.map((s) => s.values[i]).filter((v) => v != null);
    tip.style.left = `${(X(i) / W) * 100}%`; tip.style.top = `${((ys.length ? y(Math.max(...ys)) : m.t + ih / 2) / H) * 100}%`;
    tip.style.display = 'block';
  });
  hit.addEventListener('mouseleave', () => { tip.style.display = 'none'; xh.setAttribute('visibility', 'hidden'); dots.forEach((d) => d && d.setAttribute('visibility', 'hidden')); });
  return wrap;
}
function roundTop(x, y, w, hh, r) {
  r = Math.min(r, hh);
  return `M${x},${y + hh}V${y + r}Q${x},${y} ${x + r},${y}H${x + w - r}Q${x + w},${y} ${x + w},${y + r}V${y + hh}Z`;
}

export const pad2 = (n) => String(n).padStart(2, '0');
export const fmtDate = (d) => (d ? `${d.slice(8, 10)}/${d.slice(5, 7)}/${d.slice(0, 4)}` : '');
export const todayISO = () => { const d = new Date(); return `${d.getFullYear()}-${pad2(d.getMonth() + 1)}-${pad2(d.getDate())}`; };
export const nf = (x, d = 1) => (x == null || Number.isNaN(Number(x)) ? '—' : Number(x).toFixed(d).replace('.', ','));
export function download(name, text) { return window.api.saveFile({ defaultName: name, content: text, filters: [{ name: name.split('.').pop().toUpperCase(), extensions: [name.split('.').pop()] }] }); }
