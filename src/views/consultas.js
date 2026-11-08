import { h, icon, card, field, select, toast, lineChart, nf, pad2, fmtDate, todayISO, download } from '../lib/ui.js';
import { getConfig, getObs, dayObs, dayObsLocal, addDays, loadMonth, listMonths, lastObs, daysInMonth, keyOf } from '../lib/store.js';
import { bulletinHeader } from '../lib/synop.js';
import { rumboFromDD, vvText, vvToKm, WW, W_PAST, CL, CM, CH, H_BASE, MESES, TENDENCIA } from '../lib/tables.js';

const TABS = [
  ['publico', 'Datos para el público'],
  ['sinopticos', 'Datos sinópticos'],
  ['observacion', 'Datos de una observación'],
  ['busqueda', 'Búsqueda de SYNOP'],
  ['ultimo', 'Último SYNOP'],
  ['mensual', 'Resumen mensual'],
];

export async function render(root, { state, setState, go }) {
  const tab = state.tab || 'publico';
  const cfg = getConfig();
  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Visualización de la información'), h('div', { class: 'sub' }, 'Consultas, tablas diarias y mensuales, búsqueda de mensajes')),
    h('div', { class: 'actions no-print' },
      h('button', { class: 'btn', onclick: () => window.api.printPDF(`Libreta ${tab}.pdf`).then((p) => p && toast('PDF guardado')) }, icon('download'), 'Guardar PDF'),
      h('button', { class: 'btn', onclick: () => window.api.print() }, icon('print'), 'Imprimir'))));
  root.append(h('div', { class: 'tabs no-print' }, TABS.map(([id, t]) => h('button', { class: id === tab ? 'on' : '', onclick: () => go('consultas', { ...state, tab: id }) }, t))));
  const body = h('div'); root.append(body);
  const nav = (d) => go('consultas', { ...state, date: d });
  const date = state.date || todayISO();
  const dateBar = (label = 'Fecha') => {
    const inp = h('input', { class: 'inp', type: 'date', value: date, style: { width: '160px' } });
    inp.addEventListener('change', () => inp.value && nav(inp.value));
    return h('div', { class: 'row no-print', style: { marginBottom: '12px' } },
      h('button', { class: 'btn', onclick: () => nav(addDays(date, -1)) }, icon('left')), field(label, inp),
      h('button', { class: 'btn', onclick: () => nav(addDays(date, 1)) }, icon('right')));
  };
  const views = { publico, sinopticos, observacion, busqueda, ultimo, mensual };
  await views[tab](body, { cfg, date, dateBar, state, go });
}

const v0 = (o) => (o && !o.missing ? o.v || {} : {});
const cell = (x, cls = '') => h('td', { class: (x == null || x === '—' ? 'miss ' : '') + cls }, x == null ? '—' : x);

// ------------------------------------------------------------ Datos para el público
async function publico(body, { cfg, date, dateBar }) {
  const huso = Number(cfg.station.huso ?? -3);
  const rows = await dayObsLocal(date, huso);
  body.append(dateBar('Fecha (hora oficial)'));
  const t = []; let wmax = null; let pr = null;
  const tb = h('tbody');
  for (const r of rows) {
    const v = v0(r.o);
    if (v.T != null) t.push(v.T);
    if (v.ff != null && (!wmax || v.ff > wmax.ff)) wmax = { ff: v.ff, dd: v.dd, h: r.hl };
    tb.append(h('tr', {}, h('td', { class: 'c' }, h('b', {}, pad2(r.hl))),
      cell(v.T != null ? nf(v.T) : null), cell(v.HR != null ? nf(v.HR, 0) : null), cell(v.Pst != null ? nf(v.Pst) : null),
      cell(v.Pmsl != null ? nf(v.Pmsl) : null),
      cell(v.ff != null ? (v.ff === 0 ? 'Calma' : rumboFromDD(v.dd)) : null, 'c'), cell(v.ff != null ? nf(v.ff * 1.852, 0) : null),
      cell(v.N != null ? `${v.N}/8` : null), cell(v.VV != null ? nf(vvToKm(v.VV), v.VV < 50 ? 1 : 0) : null), cell(v.ST != null ? nf(v.ST) : null),
      h('td', { class: 'l small muted' }, v.ww != null && v.ww > 3 ? WW[v.ww] : '')));
  }
  const o12 = await getObs(addDays(date, 1), 12); // precipitación de las 24 h terminadas a las 12 UTC del día siguiente
  const v12 = v0(o12);
  if (v12.RRR != null) pr = v12.RRRtrace ? 'Inapreciable' : `${nf(v12.RRR)} mm`;
  body.append(h('div', { class: 'grid g4', style: { marginBottom: '12px' } },
    statCard('Temperatura máxima', t.length ? `${nf(Math.max(...t))} °C` : '—'),
    statCard('Temperatura mínima', t.length ? `${nf(Math.min(...t))} °C` : '—'),
    statCard('Viento máximo', wmax ? (wmax.ff === 0 ? 'Calma' : `${rumboFromDD(wmax.dd)} ${nf(wmax.ff * 1.852, 0)} km/h`) : '—', wmax ? `a las ${pad2(wmax.h)} HOA` : ''),
    statCard('Precipitación 24 h', pr || '—', 'hasta las 12 UTC del día siguiente')));
  body.append(h('div', {},
    h('div', { class: 'tbl-wrap', style: { marginBottom: '12px' } }, h('table', { class: 'tbl' },
      h('thead', {}, h('tr', {}, ['HOA', 'Temp. °C', 'HR %', 'P. est. hPa', 'P. mar hPa', 'Dir.', 'km/h', 'Nub.', 'Vis. km', 'S.T. °C', 'Tiempo'].map((x, i) => h('th', { class: i === 0 ? 'c' : i === 10 ? 'l' : '' }, x)))),
      tb)),
    h('div', { class: 'grid g2' },
      card('Temperatura (hora oficial)', 'thermo', lineChart({ labels: rows.map((r) => pad2(r.hl)), series: [{ name: 'Temperatura', values: rows.map((r) => v0(r.o).T ?? null), color: 'var(--series-1)' }], unit: ' °C' })),
      card('Humedad relativa', 'drop', lineChart({ labels: rows.map((r) => pad2(r.hl)), series: [{ name: 'Humedad', values: rows.map((r) => v0(r.o).HR ?? null), color: 'var(--series-1)' }], unit: ' %', yFmt: (x) => x.toFixed(0) })))));
}

function statCard(k, v, d) {
  return h('section', { class: 'card' }, h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v', style: { fontSize: '22px' } }, v), h('div', { class: 'd' }, d || ' ')));
}

// ------------------------------------------------------------ Datos sinópticos
async function sinopticos(body, { date, dateBar }) {
  body.append(dateBar('Fecha (UTC)'));
  const day = await dayObs(date);
  const tb = h('tbody');
  day.forEach((o, hh) => {
    const v = v0(o);
    tb.append(h('tr', {}, h('td', { class: 'c' }, h('b', {}, pad2(hh))),
      cell(v.T != null ? nf(v.T) : null), cell(v.Td != null ? nf(v.Td) : null), cell(v.Pst != null ? nf(v.Pst) : null), cell(v.Pmsl != null ? nf(v.Pmsl) : null),
      cell(v.a != null && v.ppp != null ? `${v.a}${String(v.ppp).padStart(3, '0')}` : null, 'mono'),
      cell(v.dd != null ? `${pad2(v.dd)}${pad2(v.ff ?? 0)}` : null, 'mono'),
      cell(v.ww != null ? pad2(v.ww) : null, 'c mono'), cell(v.W1 != null ? `${v.W1}${v.W2 ?? '/'}` : null, 'c mono'),
      cell(v.VV != null ? pad2(v.VV) : null, 'c mono'), cell(v.N != null ? String(v.N) : null, 'c'),
      cell(v.CL != null || v.CM != null || v.CH != null ? `${v.CL ?? '/'}${v.CM ?? '/'}${v.CH ?? '/'}` : null, 'c mono'),
      cell(v.h != null ? String(v.h) : null, 'c'),
      h('td', { class: 'l' }, o?.missing ? h('span', { class: 'tag warn' }, 'Faltante') : o?.imported ? h('span', { class: 'tag acc' }, 'Importada') : '')));
  });
  body.append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, ['UTC', 'Temp.', 'Rocío', 'P. est.', 'P. mar', 'appp', 'ddff', 'ww', 'W1W2', 'VV', 'N', 'CL CM CH', 'h', ''].map((x, i) => h('th', { class: i === 0 || i >= 7 ? 'c' : '' }, x)))), tb)));
  body.append(h('div', { class: 'small muted', style: { marginTop: '8px' } }, 'Temperaturas en °C, presiones en hPa, viento en nudos.'));
}

// ------------------------------------------------------------ Datos de una observación
async function observacion(body, { date, state, go }) {
  const hour = Number(state.hour ?? 12);
  const inp = h('input', { class: 'inp', type: 'date', value: date, style: { width: '160px' } });
  const hs = select([...Array(24).keys()].map((x) => [String(x), `${pad2(x)} UTC`]), hour, null, { empty: null });
  const show = () => go('consultas', { ...state, date: inp.value, hour: Number(hs.value) });
  inp.addEventListener('change', show); hs.addEventListener('change', show);
  body.append(h('div', { class: 'row no-print', style: { marginBottom: '12px' } }, field('Fecha', inp), field('Hora', hs),
    h('button', { class: 'btn', style: { alignSelf: 'flex-end' }, onclick: () => go('libreta', { date, hour }) }, icon('edit'), 'Abrir en la libreta')));
  const o = await getObs(date, hour);
  if (!o) { body.append(h('div', { class: 'card empty' }, icon('search'), h('div', {}, 'No hay observación para esa fecha y hora.'))); return; }
  if (o.missing) { body.append(h('div', { class: 'card empty' }, icon('warn'), h('div', {}, 'La observación fue registrada como faltante.'))); return; }
  const v = o.v || {};
  const kv = (rows) => h('div', { class: 'kv' }, rows.flatMap(([k, val]) => [h('div', { class: 'k' }, k), h('div', { class: 'v' }, val ?? '—')]));
  body.append(h('div', { class: 'grid g3' },
    card('Presión y temperatura', 'thermo', kv([
      ['Presión estación', v.Pst != null ? `${nf(v.Pst)} hPa` : null], ['Presión nivel del mar', v.Pmsl != null ? `${nf(v.Pmsl)} hPa` : null],
      ['Presión reducida (555)', v.Pnac != null ? `${nf(v.Pnac)} hPa` : null],
      ['Tendencia', v.a != null ? `${v.a} — ${TENDENCIA[v.a]?.split(';')[0]}` : null], ['Variación 3 h', v.ppp != null ? `${nf(v.ppp / 10)} hPa` : null],
      ['Temperatura', v.T != null ? `${nf(v.T)} °C` : null], ['Bulbo húmedo', v.Tw != null ? `${nf(v.Tw)} °C` : null],
      ['Punto de rocío', v.Td != null ? `${nf(v.Td)} °C` : null], ['Humedad relativa', v.HR != null ? `${nf(v.HR, 0)} %` : null],
      ['Sensación térmica', v.ST != null ? `${nf(v.ST)} °C` : null],
      ['Máxima / mínima', v.Tmax != null || v.Tmin != null ? `${nf(v.Tmax)} / ${nf(v.Tmin)} °C` : null]])),
    card('Viento, visibilidad y tiempo', 'wind', kv([
      ['Viento', v.ff != null ? (v.ff === 0 ? 'Calma' : `${rumboFromDD(v.dd)} (${pad2(v.dd)}) ${v.ff} kt = ${nf(v.ff * 1.852, 0)} km/h`) : null],
      ['Ráfaga', v.gust != null ? `${v.gust} kt` : null], ['Visibilidad', v.VV != null ? `${pad2(v.VV)} — ${vvText(v.VV)}` : null],
      ['Tiempo presente', v.ww != null ? `${pad2(v.ww)} — ${WW[v.ww]}` : null],
      ['Tiempo pasado', v.W1 != null ? `${v.W1}${v.W2 ?? ''} — ${W_PAST[v.W1]}` : null],
      ['Precipitación', v.RRR != null ? (v.RRRtrace ? 'Inapreciable' : `${nf(v.RRR)} mm (${v.tR === 4 ? '24' : '6'} h)`) : null]])),
    card('Nubosidad', 'cloud', kv([
      ['Total (N)', v.N != null ? `${v.N}/8` : null], ['Nh', v.Nh != null ? `${v.Nh}/8` : null],
      ['Bajas (CL)', v.CL != null ? `${v.CL} — ${CL[v.CL]}` : null], ['Medias (CM)', v.CM != null ? `${v.CM} — ${CM[v.CM]}` : null],
      ['Altas (CH)', v.CH != null ? `${v.CH} — ${CH[v.CH]}` : null], ['Base (h)', v.h != null ? `${v.h} — ${H_BASE[v.h]}` : null]]))));
  body.append(card('Mensaje SYNOP', 'code', h('div', { class: 'synop-box' }, o.synop || '—'), o.notes ? h('p', { class: 'muted small' }, 'Notas: ' + o.notes) : null));
}

// ------------------------------------------------------------ Búsqueda de SYNOP
async function busqueda(body, { cfg, date, state, go }) {
  const from = state.from || addDays(date, -1); const to = state.to || date; const hours = state.hours || 'all';
  const fi = h('input', { class: 'inp', type: 'date', value: from }); const ti = h('input', { class: 'inp', type: 'date', value: to });
  const hs = select([['all', 'Todas las horas'], ['syn', 'Sinópticas (00, 03, 06 … 21)'], ['main', 'Principales (00, 06, 12, 18)'], ...[...Array(24).keys()].map((x) => [String(x), `${pad2(x)} UTC`])], hours, null, { empty: null });
  const hdr = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: state.hdr !== false }), 'Incluir encabezado del boletín');
  body.append(h('div', { class: 'row no-print', style: { marginBottom: '12px', alignItems: 'flex-end' } },
    field('Desde', fi), field('Hasta', ti), field('Horas', hs),
    h('button', { class: 'btn primary', onclick: () => go('consultas', { ...state, from: fi.value, to: ti.value, hours: hs.value }) }, icon('search'), 'Buscar')));
  const ok = (hh) => hours === 'all' || (hours === 'syn' ? hh % 3 === 0 : hours === 'main' ? hh % 6 === 0 : Number(hours) === hh);
  const found = [];
  if (from && to && from <= to) {
    let d = from; let guard = 0;
    while (d <= to && guard++ < 400) {
      const m = await loadMonth('obs', d.slice(0, 7));
      for (let hh = 0; hh < 24; hh++) { const o = m[keyOf(d, hh)]; if (o && o.synop && ok(hh)) found.push(o); }
      d = addDays(d, 1);
    }
  }
  const text = () => found.map((o) => (hdr.querySelector('input').checked ? bulletinHeader(cfg, o.date, o.hour) + '\n' : '') + o.synop).join('\n\n');
  body.append(h('div', { class: 'row', style: { marginBottom: '8px' } }, h('span', { class: 'muted' }, `${found.length} mensajes encontrados`), h('span', { class: 'spacer' }), hdr,
    h('button', { class: 'btn', disabled: !found.length, onclick: () => { navigator.clipboard.writeText(text()); toast('Mensajes copiados'); } }, icon('copy'), 'Copiar'),
    h('button', { class: 'btn', disabled: !found.length, onclick: () => download(`SYNOP ${from} a ${to}.txt`, text().replace(/\n/g, '\r\n')) }, icon('download'), 'Exportar TXT')));
  if (!found.length) { body.append(h('div', { class: 'card empty' }, icon('search'), h('div', {}, 'No hay mensajes en ese período.'))); return; }
  body.append(h('div', { class: 'tbl-wrap', style: { maxHeight: 'calc(100vh - 330px)' } }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, h('th', { class: 'l' }, 'Fecha'), h('th', { class: 'c' }, 'Hora'), h('th', { class: 'l' }, 'Mensaje'))),
    h('tbody', {}, found.map((o) => h('tr', {}, h('td', { class: 'l' }, fmtDate(o.date)), h('td', { class: 'c' }, `${pad2(o.hour)}Z`),
      h('td', { class: 'l mono', style: { whiteSpace: 'normal' } }, o.synop.replace('\n', ' '))))))));
}

// ------------------------------------------------------------ Último SYNOP
async function ultimo(body, { cfg }) {
  const o = await lastObs();
  if (!o) { body.append(h('div', { class: 'card empty' }, icon('cloud'), h('div', {}, 'Todavía no hay mensajes.'))); return; }
  const txt = `${bulletinHeader(cfg, o.date, o.hour)}\n${o.synop}`;
  body.append(card(`Último SYNOP — ${fmtDate(o.date)} ${pad2(o.hour)} UTC`, 'code',
    h('div', { class: 'synop-box', style: { fontSize: '16px', lineHeight: '26px', padding: '16px' } }, txt),
    h('div', { class: 'row', style: { marginTop: '12px' } },
      h('button', { class: 'btn primary', onclick: () => { navigator.clipboard.writeText(txt); toast('Mensaje copiado'); } }, icon('copy'), 'Copiar'),
      h('button', { class: 'btn', onclick: () => download(`SYNOP ${o.date} ${pad2(o.hour)}Z.txt`, txt.replace(/\n/g, '\r\n')) }, icon('download'), 'Guardar como TXT'))));
}

// ------------------------------------------------------------ Resumen mensual
export async function monthSummary(ym) {
  const m = await loadMonth('obs', ym);
  const n = daysInMonth(ym);
  const out = [];
  const [y, mo] = ym.split('-').map(Number);
  const nextYm = mo === 12 ? `${y + 1}-01` : `${y}-${pad2(mo + 1)}`;
  const mNext = await loadMonth('obs', nextYm);
  for (let d = 1; d <= n; d++) {
    const date = `${ym}-${pad2(d)}`;
    const vs = []; let tmx = null; let tmn = null;
    for (let hh = 0; hh < 24; hh++) { const o = m[keyOf(date, hh)]; if (o && !o.missing && o.v) vs.push(o.v); }
    const T = vs.map((v) => v.T).filter((x) => x != null);
    // extremas informadas: máxima a las 00 UTC del día siguiente, mínima a las 12 UTC del día
    const next = addDays(date, 1);
    const o00 = (next.slice(0, 7) === ym ? m : mNext)[keyOf(next, 0)];
    const o12 = m[keyOf(date, 12)];
    tmx = o00?.v?.Tmax ?? (T.length ? Math.max(...T) : null);
    tmn = o12?.v?.Tmin ?? (T.length ? Math.min(...T) : null);
    const o12n = (next.slice(0, 7) === ym ? m : mNext)[keyOf(next, 12)];
    const avg = (k) => { const a = vs.map((v) => v[k]).filter((x) => x != null); return a.length ? a.reduce((s, x) => s + x, 0) / a.length : null; };
    const ffm = vs.reduce((a, v) => (v.ff != null && (!a || v.ff > a.ff) ? v : a), null);
    out.push({
      date, n: vs.length, tmx, tmn, tmed: T.length ? T.reduce((s, x) => s + x, 0) / T.length : null,
      hr: avg('HR'), pmsl: avg('Pmsl'), pr: o12n?.v?.RRR ?? null, prTrace: !!o12n?.v?.RRRtrace,
      ffmax: ffm ? ffm.ff : null, ddmax: ffm ? ffm.dd : null,
    });
  }
  return out;
}

async function mensual(body, { date, state, go }) {
  const months = await listMonths('obs');
  const ym = state.ym || months.at(-1) || date.slice(0, 7);
  const opts = months.slice().reverse().map((x) => [x, `${MESES[Number(x.slice(5)) - 1]} ${x.slice(0, 4)}`]);
  if (!months.includes(ym)) opts.unshift([ym, ym]);
  const s = select(opts, ym, (v) => go('consultas', { ...state, ym: v }), { empty: null });
  const rows = await monthSummary(ym);
  const csv = () => ['Fecha;Observaciones;Tmax;Tmin;Tmed;HR media;P mar media;Precipitacion 24h (12 UTC dia siguiente);Viento max (kt);Dir',
    ...rows.map((r) => [r.date, r.n, r.tmx, r.tmn, r.tmed, r.hr, r.pmsl, r.prTrace ? 'inap' : r.pr, r.ffmax, r.ddmax].map((x) => (x == null ? '' : typeof x === 'number' ? String(Math.round(x * 10) / 10).replace('.', ',') : x)).join(';'))].join('\r\n');
  body.append(h('div', { class: 'row no-print', style: { marginBottom: '12px', alignItems: 'flex-end' } }, field('Mes', s), h('span', { class: 'spacer' }),
    h('button', { class: 'btn', onclick: () => download(`Resumen ${ym}.csv`, csv()) }, icon('download'), 'Exportar a Excel (CSV)')));
  const valid = rows.filter((r) => r.n);
  const mean = (k) => { const a = valid.map((r) => r[k]).filter((x) => x != null); return a.length ? a.reduce((s2, x) => s2 + x, 0) / a.length : null; };
  const prTot = rows.reduce((a, r) => a + (r.pr || 0), 0);
  body.append(h('div', { class: 'grid g2', style: { marginBottom: '12px' } },
    card('Temperaturas extremas diarias', 'thermo', lineChart({
      labels: rows.map((r) => r.date.slice(8)), height: 190,
      series: [{ name: 'Máxima', values: rows.map((r) => r.tmx), color: 'var(--series-2)', unit: ' °C' }, { name: 'Mínima', values: rows.map((r) => r.tmn), color: 'var(--series-1)', unit: ' °C' }] })),
    card('Precipitación diaria (mm)', 'drop', lineChart({ labels: rows.map((r) => r.date.slice(8)), height: 190, zero: true, series: [{ name: 'Precipitación', values: rows.map((r) => r.pr), color: 'var(--series-1)', kind: 'bar' }], unit: ' mm' }))));
  const tb = h('tbody', {}, rows.map((r) => h('tr', {},
    h('td', { class: 'l' }, fmtDate(r.date)), cell(r.n || null), cell(r.tmx != null ? nf(r.tmx) : null), cell(r.tmn != null ? nf(r.tmn) : null), cell(r.tmed != null ? nf(r.tmed) : null),
    cell(r.hr != null ? nf(r.hr, 0) : null), cell(r.pmsl != null ? nf(r.pmsl) : null), cell(r.prTrace ? 'inap.' : r.pr != null ? nf(r.pr) : null),
    cell(r.ffmax != null ? `${rumboFromDD(r.ddmax) || ''} ${r.ffmax}` : null))));
  tb.append(h('tr', { class: 'sum' }, h('td', { class: 'l' }, 'Mes'), cell(valid.reduce((a, r) => a + r.n, 0)),
    cell(mean('tmx') != null ? nf(mean('tmx')) : null), cell(mean('tmn') != null ? nf(mean('tmn')) : null), cell(mean('tmed') != null ? nf(mean('tmed')) : null),
    cell(mean('hr') != null ? nf(mean('hr'), 0) : null), cell(mean('pmsl') != null ? nf(mean('pmsl')) : null), cell(nf(prTot)), cell('')));
  body.append(h('div', { class: 'tbl-wrap' }, h('table', { class: 'tbl' },
    h('thead', {}, h('tr', {}, ['Fecha', 'Obs.', 'Máx. °C', 'Mín. °C', 'Media °C', 'HR %', 'P. mar hPa', 'Precip. mm', 'Viento máx. kt'].map((x, i) => h('th', { class: i === 0 ? 'l' : '' }, x)))), tb)));
  body.append(h('div', { class: 'small muted', style: { marginTop: '8px' } }, 'Máxima informada a las 00 UTC del día siguiente y mínima informada a las 12 UTC (si no existen, se usan los valores horarios). Precipitación: total de 24 h informado a las 12 UTC del día siguiente.'));
}
