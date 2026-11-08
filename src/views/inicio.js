import { h, icon, card, lineChart, nf, fmtDate, pad2, dialog, toast } from '../lib/ui.js';
import { getConfig, lastObs, lastEntry, addHours, getObs, dayObs, listMonths, loadMonth, invalidate, loadConfig } from '../lib/store.js';
import { rumboFromDD, WW, vvText } from '../lib/tables.js';
import { updateStationChip } from '../app.js';

export function nextHour(cfg, last) {
  const now = new Date();
  const cur = { date: now.toISOString().slice(0, 10), hour: now.getUTCHours() };
  if (!last) return cur;
  const nx = addHours(last.date, last.hour, 1);
  // si la última está muy atrasada, sugerir la hora actual
  const tNx = Date.parse(`${nx.date}T${pad2(nx.hour)}:00:00Z`);
  if (Date.now() - tNx > 48 * 3600e3) return cur;
  return nx;
}

export async function render(root, { go }) {
  const cfg = getConfig(); const st = cfg.station;
  const huso = Number(st.huso ?? -3);
  const last = await lastObs();
  const lastAny = await lastEntry();
  const nx = nextHour(cfg, lastAny);
  const hl = (u) => (u + huso + 24) % 24;

  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, st.name || 'Libreta Meteorológica'),
      h('div', { class: 'sub' }, [
        st.index ? `Indicativo OMM ${st.index}` : 'Estación sin configurar',
        st.index && st.latDeg != null ? ` · ${st.latDeg}°${pad2(st.latMin || 0)}′ S  ${st.lonDeg}°${pad2(st.lonMin || 0)}′ W` : '',
        st.altitude ? ` · ${st.altitude} m` : '',
      ].join(''))),
    h('div', { class: 'actions' }, h('span', { class: 'muted small', id: 'clock' }))));

  const clock = root.querySelector('#clock');
  const tick = () => {
    const d = new Date();
    clock.textContent = `${pad2(d.getUTCHours())}:${pad2(d.getUTCMinutes())} UTC · ${pad2(d.getHours())}:${pad2(d.getMinutes())} hora local`;
  };
  tick(); const iv = setInterval(() => { if (!document.body.contains(clock)) clearInterval(iv); else tick(); }, 15000);

  if (cfg._new) {
    root.append(h('div', { class: 'alert info', style: { marginBottom: '16px' } }, icon('info'), h('div', {},
      h('b', {}, 'Bienvenido. '), 'Para comenzar, importe los datos del programa LIBRETA anterior o cargue los datos de la estación. ',
      h('div', { class: 'row', style: { marginTop: '8px' } },
        h('button', { class: 'btn primary', onclick: () => importLegacyFlow(go) }, icon('upload'), 'Importar datos del programa anterior'),
        h('button', { class: 'btn', onclick: () => go('estacion') }, icon('station'), 'Cargar datos de la estación')))));
  }

  // tarjeta de próxima observación + última observación
  const v = last?.v || {};
  const next = h('section', { class: 'card next-obs' },
    h('div', { class: 'muted small' }, 'Corresponde ingresar'),
    h('div', { class: 'big-temp', style: { margin: '6px 0 2px' } }, `${pad2(nx.hour)} UTC`),
    h('div', {}, `${fmtDate(nx.date)} · ${pad2(hl(nx.hour))}:00 hora oficial`),
    h('div', { class: 'muted small', style: { margin: '6px 0 16px' } },
      lastAny ? `Último ingreso: ${fmtDate(lastAny.date)} ${pad2(lastAny.hour)} UTC${lastAny.missing ? ' (faltante)' : ''}` : 'Todavía no hay observaciones cargadas.'),
    h('button', { class: 'btn lg', onclick: () => go('libreta', { date: nx.date, hour: nx.hour }) }, icon('edit'), 'Ingresar observación'));

  const lastCard = card(last ? `Última observación · ${fmtDate(last.date)} ${pad2(last.hour)} UTC` : 'Última observación', 'clock',
    last ? h('div', {},
      h('div', { class: 'grid g2' },
        stat('Temperatura', nf(v.T), '°C', v.ST != null && Math.abs(v.ST - v.T) >= 1 ? `Sensación ${nf(v.ST, 0)} °C` : ''),
        stat('Humedad', nf(v.HR, 0), '%', v.Td != null ? `Rocío ${nf(v.Td)} °C` : ''),
        stat('Presión', nf(v.Pmsl), 'hPa', v.Pst != null ? `Estación ${nf(v.Pst)} hPa` : ''),
        stat('Viento', v.ff == null ? '—' : v.ff === 0 ? 'Calma' : `${rumboFromDD(v.dd) || ''} ${v.ff}`, v.ff ? 'kt' : '', v.ff ? `${nf(v.ff * 1.852, 0)} km/h` : ''),
      ),
      h('hr', { class: 'sep' }),
      h('div', { class: 'grid g2' },
        h('div', { class: 'small' }, h('div', { class: 'muted' }, 'Tiempo presente'), v.ww != null ? `${pad2(v.ww)} — ${WW[v.ww]}` : '—'),
        h('div', { class: 'small' }, h('div', { class: 'muted' }, 'Nubosidad · Visibilidad'), `${v.N != null ? v.N + '/8' : '—'} · ${v.VV != null ? vvText(v.VV) : '—'}`)),
      h('div', { class: 'synop-box', style: { marginTop: '12px' } }, last.synop || ''))
      : h('div', { class: 'empty' }, icon('cloud'), h('div', {}, 'Sin observaciones')));

  root.append(h('div', { class: 'hero' }, next, lastCard));

  // gráfico de las últimas 24 horas
  const labels = []; const T = []; const P = [];
  const endRef = last ? { date: last.date, hour: last.hour } : nx;
  for (let i = 23; i >= 0; i--) {
    const b = addHours(endRef.date, endRef.hour, -i);
    const o = await getObs(b.date, b.hour);
    labels.push(`${pad2(b.hour)}Z`); T.push(o?.v?.T ?? null); P.push(o?.v?.Pmsl ?? null);
  }
  const charts = h('div', { class: 'grid g2', style: { marginTop: '12px' } },
    card('Temperatura — últimas 24 horas', 'thermo', lineChart({ labels, series: [{ name: 'Temperatura', values: T, color: 'var(--series-1)' }], unit: ' °C' })),
    card('Presión a nivel del mar — últimas 24 horas', 'pressure', lineChart({ labels, series: [{ name: 'Presión', values: P, color: 'var(--series-1)' }], unit: ' hPa' })));
  root.append(charts);

  // resumen de datos
  const months = await listMonths('obs');
  let total = 0;
  for (const m of months.slice(-1)) total = Object.keys(await loadMonth('obs', m)).length;
  root.append(h('div', { class: 'grid g3', style: { marginTop: '12px' } },
    quick('Libreta', 'Ingresar o corregir observaciones horarias y generar el SYNOP.', 'book', () => go('libreta')),
    quick('Visualización', 'Datos para el público, datos sinópticos, búsqueda de SYNOP y resúmenes.', 'chart', () => go('consultas')),
    quick('Respaldo', months.length ? `${months.length} meses con datos (${total} registros en ${months.at(-1)}).` : 'Aún no hay datos para respaldar.', 'archive', () => go('admin'))));
}

function stat(k, v, u, d) {
  return h('div', { class: 'stat' }, h('div', { class: 'k' }, k), h('div', { class: 'v' }, v, u ? h('small', {}, u) : null), h('div', { class: 'd' }, d || ' '));
}
function quick(t, d, ic, fn) {
  return h('section', { class: 'card', style: { cursor: 'default' }, onclick: fn },
    h('div', { class: 'card-title' }, h('div', { class: 'ic' }, icon(ic)), h('h3', {}, t), h('span', { class: 'hint' }, icon('right'))),
    h('div', { class: 'muted small' }, d));
}

export async function importLegacyFlow(go, dir) {
  const res = await window.api.importLegacy(dir ? { dir } : {});
  if (!res) return;
  const cfg = getConfig();
  const changes = [];
  if (res.station) {
    const s = res.station;
    Object.assign(cfg.station, {
      code: s.code, name: s.name, index: s.index, latDeg: s.latDeg, latMin: s.latMin, lonDeg: s.lonDeg, lonMin: s.lonMin,
      altitude: s.altitude, tabla: s.tabla, presMedia: s.presMedia, tensMedia: s.tensMedia, corrGrav: s.corrGrav,
    });
    changes.push('datos de la estación');
  }
  if (res.corrections) { Object.assign(cfg.corrections, res.corrections); changes.push('correcciones del instrumental'); }
  if (res.limits) { cfg.limits = { ...cfg.limits, ...res.limits }; changes.push('límites de los parámetros'); }
  const { saveConfig } = await import('../lib/store.js');
  await saveConfig(cfg); invalidate(); await loadConfig(); updateStationChip();
  const dlg = dialog({
    title: 'Importación terminada',
    body: h('div', {},
      h('p', {}, `Se importaron ${res.nObs.toLocaleString('es-AR')} observaciones (mensajes SYNOP) y ${res.nReg.toLocaleString('es-AR')} registros de instrumentos registradores.`),
      res.months.length ? h('p', { class: 'muted' }, `Período: ${res.months[0]} a ${res.months.at(-1)}.`) : null,
      changes.length ? h('p', { class: 'muted' }, `También se cargaron: ${changes.join(', ')}.`) : null,
      Object.keys(res.stations).length > 1 ? h('p', { class: 'muted small' }, `La carpeta contenía archivos de varias estaciones (${Object.keys(res.stations).join(', ')}); solo se importó la estación configurada (${res.station?.code || ''}).`) : null),
  });
  if (!dir) await dlg; else document.querySelector('.overlay')?.remove();
  toast('Datos importados');
  go('inicio');
}
