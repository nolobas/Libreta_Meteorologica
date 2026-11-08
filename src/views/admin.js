import { h, icon, card, field, select, toast, confirmDlg, askPassword, fmtDate, pad2, download } from '../lib/ui.js';
import { getConfig, listMonths, loadMonth, lastEntry, deleteObs, invalidate, loadConfig, keyOf } from '../lib/store.js';
import { bulletinHeader } from '../lib/synop.js';
import { MESES, rumboFromDD } from '../lib/tables.js';
import { importLegacyFlow } from './inicio.js';
import { buildSynFile } from '../lib/legacy.js';
import { updateStationChip } from '../app.js';

let unlocked = false;

export async function render(root, { go }) {
  const cfg = getConfig();
  if (!unlocked && !(await askPassword(cfg.system.password, 'la administración del sistema'))) { go('inicio'); return; }
  unlocked = true;
  const months = await listMonths('obs');
  const dir = await window.api.dataDir();
  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Administración del sistema'), h('div', { class: 'sub' }, 'Respaldos, archivos para enviar al SMN, importación y mantenimiento'))));

  const monthName = (m) => `${MESES[Number(m.slice(5)) - 1]} ${m.slice(0, 4)}`;
  const monthOpts = months.slice().reverse().map((m) => [m, monthName(m)]);
  const years = [...new Set(months.map((m) => m.slice(0, 4)))].reverse();

  // 1 — respaldo actual
  const bk = card('Respaldo actual de datos', 'archive',
    h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Guarda en un único archivo comprimido (.zip) todos los datos y la configuración. Se puede guardar en un pendrive, otra carpeta o la nube.'),
    h('button', { class: 'btn primary', onclick: async () => {
      const r = await window.api.backup({ defaultName: `Respaldo Libreta ${new Date().toISOString().slice(0, 10)}.zip` });
      if (r?.error) toast(r.error, 'err'); else if (r) toast(`Respaldo guardado (${r.count} archivos)`);
    } }, icon('archive'), 'Crear respaldo completo'));

  // 2 — respaldo trimestral
  const ySel = select(years.map((y) => [y, y]), years[0], null, { empty: null });
  const qSel = select([['1', '1er trimestre (ene–mar)'], ['2', '2do trimestre (abr–jun)'], ['3', '3er trimestre (jul–sep)'], ['4', '4to trimestre (oct–dic)']], String(Math.floor(new Date().getMonth() / 3) + 1), null, { empty: null });
  const tri = card('Respaldo trimestral de datos', 'calendar',
    h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Respalda solamente los tres meses del trimestre elegido.'),
    h('div', { class: 'row', style: { alignItems: 'flex-end' } }, field('Año', ySel), field('Trimestre', qSel),
      h('button', { class: 'btn', disabled: !years.length, onclick: async () => {
        const q = Number(qSel.value); const y = ySel.value;
        const ms = [1, 2, 3].map((k) => `${y}-${pad2((q - 1) * 3 + k)}`);
        const r = await window.api.backup({ months: ms, defaultName: `Respaldo Libreta ${y} T${q}.zip` });
        if (r?.error) toast(r.error, 'err'); else if (r) toast(`Respaldo del trimestre guardado (${r.count} archivos)`);
      } }, icon('archive'), 'Respaldar trimestre')));

  // 3 — archivos para enviar al SMN
  const mSel = select(monthOpts, monthOpts[0]?.[0], null, { empty: null });
  const smn = card('Archivos para enviar al SMN', 'upload',
    h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Genera los archivos de un mes: mensajes SYNOP con encabezado de boletín, tabla horaria para planilla de cálculo y archivo .SYN compatible con el programa anterior.'),
    h('div', { class: 'row', style: { alignItems: 'flex-end' } }, field('Mes', mSel),
      h('button', { class: 'btn', disabled: !months.length, onclick: () => exportSynop(mSel.value) }, icon('download'), 'SYNOP (.txt)'),
      h('button', { class: 'btn', disabled: !months.length, onclick: () => exportCsv(mSel.value) }, icon('download'), 'Datos horarios (.csv)'),
      h('button', { class: 'btn', disabled: !months.length, onclick: () => exportLegacySyn(mSel.value) }, icon('download'), 'Formato anterior (.SYN)')));

  // 4 — borrar la última observación
  const last = await lastEntry();
  const del = card('Borrar la última observación', 'trash',
    h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Elimina la última observación ingresada (destraba el sistema si se ingresó con fecha u hora equivocada).'),
    last ? h('div', { class: 'row' }, h('span', { class: 'tag' }, `${fmtDate(last.date)} ${pad2(last.hour)} UTC${last.missing ? ' (faltante)' : ''}`),
      h('button', { class: 'btn danger', onclick: async () => {
        if (!await confirmDlg('Borrar la última observación', `Se eliminará la observación del ${fmtDate(last.date)} a las ${pad2(last.hour)} UTC. Esta acción no se puede deshacer. ¿Está seguro?`, 'Borrar', true)) return;
        await deleteObs(last.date, last.hour); toast('Observación eliminada'); go('admin');
      } }, icon('trash'), 'Borrar')) : h('div', { class: 'muted' }, 'No hay observaciones.'));

  // 5 — importar / restaurar
  const imp = card('Importar y restaurar', 'upload',
    h('p', { class: 'muted small', style: { marginTop: 0 } }, 'Importe los datos del programa LIBRETA de MS-DOS eligiendo su carpeta (por ejemplo C:\\LIBRETA). Se leen los mensajes SYNOP, los registradores, los datos de la estación, las correcciones y los límites. Las observaciones cargadas en este programa no se sobrescriben.'),
    h('div', { class: 'row' },
      h('button', { class: 'btn primary', onclick: () => importLegacyFlow(go) }, icon('upload'), 'Importar programa anterior'),
      h('button', { class: 'btn', onclick: async () => {
        if (!await confirmDlg('Restaurar respaldo', 'Los datos del respaldo reemplazarán a los archivos actuales con el mismo nombre. ¿Continuar?', 'Restaurar')) return;
        const r = await window.api.restore(); if (r) { invalidate(); await loadConfig(); updateStationChip(); toast(`Se restauraron ${r.count} archivos`); go('admin'); }
      } }, icon('refresh'), 'Restaurar un respaldo')));

  // 6 — carpeta de datos
  const folder = card('Carpeta de datos', 'folder',
    h('div', { class: 'mono small', style: { marginBottom: '10px', wordBreak: 'break-all' } }, dir),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: () => window.api.openDataDir() }, icon('folder'), 'Abrir carpeta'),
      h('button', { class: 'btn', onclick: async () => {
        const d = await window.api.chooseDataDir(); if (d) { invalidate(); await loadConfig(); updateStationChip(); toast('Carpeta de datos cambiada'); go('admin'); }
      } }, icon('edit'), 'Cambiar carpeta…')),
    h('p', { class: 'muted small' }, `${months.length} meses con observaciones.`));

  root.append(h('div', { class: 'grid g2' }, bk, tri, smn, del, imp, folder));

  async function exportSynop(ym) {
    const m = await loadMonth('obs', ym);
    const keys = Object.keys(m).sort();
    const txt = keys.map((k) => m[k]).filter((o) => o.synop).map((o) => `${bulletinHeader(cfg, o.date, o.hour)}\r\n${o.synop.replace(/\n/g, '\r\n')}`).join('\r\n\r\n');
    if (!txt) { toast('No hay mensajes en ese mes', 'err'); return; }
    const p = await download(`SYNOP ${cfg.station.index || ''} ${ym}.txt`, txt);
    if (p) toast('Archivo guardado');
  }
  async function exportCsv(ym) {
    const m = await loadMonth('obs', ym);
    const f = (x, d = 1) => (x == null ? '' : Number(x).toFixed(d).replace('.', ','));
    const lines = ['Fecha;Hora UTC;Faltante;T (°C);Tw (°C);Td (°C);HR (%);e (hPa);P est (hPa);P mar (hPa);a;ppp;Dir;dd;ff (kt);N;Nh;CL;CM;CH;h;VV;ww;W1;W2;Tmax;Tmin;Precip (mm);SYNOP'];
    for (const k of Object.keys(m).sort()) {
      const o = m[k]; const v = o.v || {};
      lines.push([o.date, pad2(o.hour), o.missing ? 'S' : '', f(v.T), f(v.Tw), f(v.Td), f(v.HR, 0), f(v.e), f(v.Pst), f(v.Pmsl), v.a ?? '', v.ppp ?? '',
        v.dd != null ? rumboFromDD(v.dd) : '', v.dd ?? '', v.ff ?? '', v.N ?? '', v.Nh ?? '', v.CL ?? '', v.CM ?? '', v.CH ?? '', v.h ?? '', v.VV ?? '', v.ww ?? '', v.W1 ?? '', v.W2 ?? '',
        f(v.Tmax), f(v.Tmin), v.RRRtrace ? 'inap' : f(v.RRR), `"${(o.synop || '').replace(/\s+/g, ' ')}"`].join(';'));
    }
    const p = await download(`Datos horarios ${ym}.csv`, lines.join('\r\n'));
    if (p) toast('Archivo guardado');
  }
  async function exportLegacySyn(ym) {
    const m = await loadMonth('obs', ym); const code = String(cfg.station.code || '000').padStart(3, '0');
    const out = buildSynFile(Object.keys(m).sort().map((k) => m[k]), code);
    if (!out) { toast('No hay mensajes en ese mes', 'err'); return; }
    const p = await window.api.saveFile({ defaultName: `${code}${ym.slice(1, 4)}${ym.slice(5)}.SYN`, content: out, encoding: 'latin1', filters: [{ name: 'SYN', extensions: ['SYN'] }] });
    if (p) toast('Archivo guardado');
  }
}
