import { h, icon, card, field, toast, confirmDlg, lineChart, nf, pad2, fmtDate, todayISO, alertBox } from '../lib/ui.js';
import { getConfig, getReg, saveReg, getDia, saveDia, addDays } from '../lib/store.js';
import { FENOMENOS } from '../lib/tables.js';
import { dayLength, isNum } from '../lib/meteo.js';

const COLS = [
  { k: 'termo', label: 'Termógrafo', unit: '°C', dec: 1 },
  { k: 'higro', label: 'Higrógrafo', unit: '%', dec: 0 },
  { k: 'baro', label: 'Barógrafo', unit: 'hPa', dec: 1 },
  { k: 'helio', label: 'Heliofanógrafo', unit: 'h', dec: 1 },
];

export async function render(root, { state, setState, go }) {
  const cfg = getConfig(); const sys = cfg.system || {}; const st = cfg.station || {}; const L = cfg.limits || {};
  const date = state.date || addDays(todayISO(), -1);
  setState({ date });
  const baroUnit = String(sys.barografoUnidad || '2');
  const cols = COLS.map((c) => (c.k === 'baro' ? { ...c, unit: baroUnit === '1' ? 'mmHg' : 'hPa', off: baroUnit === '3' } : c.k === 'helio' ? { ...c, off: sys.heliofanografo === false } : c));
  const rec = (await getReg(date)) || {};
  const data = {}; for (const c of cols) data[c.k] = Array.isArray(rec[c.k]) ? [...rec[c.k]] : Array(24).fill(null);
  const dia = (await getDia(date)) || { fen: {} };
  let dirty = false;

  const range = {
    termo: [Number(L.min?.seco ?? -30) - 5, Number(L.max?.seco ?? 50) + 5],
    higro: [0, 100],
    baro: baroUnit === '1' ? [550, 800] : [700, 1080],
    helio: [0, 1],
  };

  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Registradores y datos diarios'), h('div', { class: 'sub' }, 'Valores horarios de termógrafo, higrógrafo, barógrafo y heliofanógrafo (hora oficial 01 a 24)')),
    h('div', { class: 'actions' },
      h('button', { class: 'btn', onclick: async () => { if (await leave()) go('registradores', { date: addDays(date, -1) }); } }, icon('left'), 'Día anterior'),
      (() => { const d = h('input', { class: 'inp', type: 'date', value: date, style: { width: '160px' } }); d.addEventListener('change', async () => { if (d.value && await leave()) go('registradores', { date: d.value }); }); return d; })(),
      h('button', { class: 'btn', onclick: async () => { if (await leave()) go('registradores', { date: addDays(date, 1) }); } }, 'Día siguiente', icon('right')))));
  const leave = async () => !dirty || await confirmDlg('Cambios sin guardar', 'Hay cambios sin guardar. ¿Desea descartarlos?', 'Descartar', true);

  if (rec.imported) root.append(h('div', { style: { marginBottom: '12px' } }, alertBox('info', 'Valores importados del programa anterior.')));

  // ---------------- tabla horaria
  const tbody = h('tbody');
  const summary = h('div', { class: 'kv' });
  const chartBox = h('div');
  const inputs = [];
  for (let i = 0; i < 24; i++) {
    const tr = h('tr', {}, h('td', { class: 'c' }, h('b', {}, pad2(i + 1))));
    cols.forEach((c, ci) => {
      const v = data[c.k][i];
      const inp = h('input', { class: 'cell', value: v == null ? '' : String(v), disabled: c.off, inputmode: 'decimal' });
      inp.addEventListener('input', () => {
        inp.value = inp.value.replace(',', '.');
        const t = inp.value.trim();
        const n = t === '' || t === '/' ? null : Number(t);
        const bad = t !== '' && t !== '/' && (Number.isNaN(n) || n < range[c.k][0] || n > range[c.k][1]);
        inp.classList.toggle('bad', bad);
        data[c.k][i] = bad ? data[c.k][i] : n; if (!bad) { dirty = true; update(); }
      });
      inp.addEventListener('keydown', (e) => {
        const move = (di, dj) => { const t = inputs[i + di]?.[ci + dj]; if (t && !t.disabled) { e.preventDefault(); t.focus(); t.select(); } };
        if (e.key === 'Enter' || e.key === 'ArrowDown') move(1, 0);
        else if (e.key === 'ArrowUp') move(-1, 0);
        else if (e.key === 'ArrowRight' && inp.selectionStart === inp.value.length) move(0, 1);
        else if (e.key === 'ArrowLeft' && inp.selectionStart === 0) move(0, -1);
      });
      (inputs[i] ||= [])[ci] = inp;
      tr.append(h('td', {}, inp));
    });
    tbody.append(tr);
  }
  const table = h('div', { class: 'tbl-wrap', style: { maxHeight: 'calc(100vh - 260px)' } },
    h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, h('th', { class: 'c' }, 'HOA'), cols.map((c) => h('th', {}, `${c.label} (${c.unit})`)))),
      tbody));

  // ---------------- heliofanía y extremos
  const helioIni = h('input', { class: 'inp', type: 'time', value: dia.helioIni || '' });
  const helioFin = h('input', { class: 'inp', type: 'time', value: dia.helioFin || '' });
  [helioIni, helioFin].forEach((x) => x.addEventListener('input', () => { dirty = true; }));
  const lat = -(Number(st.latDeg || 0) + Number(st.latMin || 0) / 60);

  // extremos dentro de un período UTC [u0, u1) usando la hora oficial k = 1..24
  function extremos(arr, u0, u1, huso) {
    let mx = null; let mn = null;
    for (let k = 1; k <= 24; k++) {
      const u = (((k - huso) % 24) + 24) % 24; if (u < u0 || u >= u1) continue;
      const v = arr[k - 1]; if (v == null) continue;
      if (!mx || v > mx.v) mx = { v, h: k }; if (!mn || v < mn.v) mn = { v, h: k };
    }
    return { mx, mn };
  }
  function update() {
    const helio = data.helio.filter((x) => x != null);
    const efect = helio.reduce((a, b) => a + b, 0);
    const teor = st.latDeg != null ? dayLength(lat, date) : null;
    const huso = Number(st.huso ?? -3);
    const p1 = extremos(data.termo, 0, 12, huso);
    const day = extremos(data.termo, 12, 24, huso);
    const t = data.termo.filter((x) => x != null);
    summary.replaceChildren(
      ...kvr('Temperatura máxima del día', t.length ? `${nf(Math.max(...t))} °C` : null),
      ...kvr('Temperatura mínima del día', t.length ? `${nf(Math.min(...t))} °C` : null),
      ...kvr('Hora de máx. (12–00 UTC)', day.mx ? `${pad2(day.mx.h)}:00 HOA` : null),
      ...kvr('Hora de mín. (00–12 UTC)', p1.mn ? `${pad2(p1.mn.h)}:00 HOA` : null),
      ...kvr('Humedad media', data.higro.some((x) => x != null) ? `${nf(avg(data.higro), 0)} %` : null),
      ...kvr('Heliofanía efectiva', helio.length ? `${nf(efect)} h` : null),
      ...kvr('Heliofanía teórica', teor != null ? `${nf(teor)} h` : null),
      ...kvr('Heliofanía relativa', helio.length && teor ? `${nf((100 * efect) / teor, 0)} %` : null),
    );
    if (teor && efect > teor + 0.05) summary.append(h('div', { style: { gridColumn: '1 / -1', marginTop: '6px' } }, alertBox('warn', 'La heliofanía efectiva es mayor que la astronómica: revise los valores horarios.')));
    chartBox.replaceChildren(lineChart({ labels: [...Array(24).keys()].map((k) => pad2(k + 1)), series: [{ name: 'Termógrafo', values: data.termo, color: 'var(--series-1)' }], unit: ' °C', height: 200, width: 440 }));
  }

  // ---------------- fenómenos del día
  const fen = { ...(dia.fen || {}) };
  const fenBox = h('div', { class: 'grid', style: { gridTemplateColumns: 'repeat(2, minmax(0,1fr))', gap: '4px 12px' } },
    FENOMENOS.map((f, i) => h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: !!fen[i + 1], onchange: (e) => { fen[i + 1] = e.target.checked ? 1 : 0; dirty = true; } }), `${i + 1}. ${f}`)));

  const save = async () => {
    const out = { ...rec }; delete out.imported;
    for (const c of cols) out[c.k] = data[c.k];
    await saveReg(date, out);
    await saveDia(date, { ...dia, fen, helioIni: helioIni.value, helioFin: helioFin.value });
    dirty = false; toast(`Datos del ${fmtDate(date)} guardados`);
  };
  const onKey = (e) => {
    if (!document.body.contains(root)) { document.removeEventListener('keydown', onKey); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); save(); }
  };
  document.addEventListener('keydown', onKey);

  root.append(h('div', { class: 'entry' },
    h('div', {}, table,
      h('div', { class: 'small muted', style: { marginTop: '8px' } }, 'Deje la celda vacía (o escriba /) si falta el valor. Para la heliofanía escriba 0 en horas nocturnas o con cielo cubierto. Use las flechas o Enter para moverse.')),
    h('div', { class: 'sticky' },
      card('Resumen del día', 'chart', summary, h('hr', { class: 'sep' }), chartBox),
      card('Heliofanía', 'sun', h('div', { class: 'fields' }, field('Comienzo (HOA)', helioIni), field('Fin (HOA)', helioFin))),
      card('Fenómenos e hidrometeoros del día', 'cloud', fenBox),
      h('button', { class: 'btn primary lg', onclick: save }, icon('save'), 'Guardar'))));
  update();
}

function kvr(k, v) { return [h('div', { class: 'k' }, k), h('div', { class: 'v' }, v ?? '—')]; }
function avg(a) { const x = a.filter((v) => v != null); return x.length ? x.reduce((s, v) => s + v, 0) / x.length : null; }
