import { h, icon, card, field, numInput, select, toast, askPassword, alertBox, fmtDate, todayISO } from '../lib/ui.js';
import { getConfig, saveConfig } from '../lib/store.js';
import { updateStationChip } from '../app.js';

let unlocked = false;

export async function render(root, { state, go }) {
  const cfg = structuredClone(getConfig());
  if (!unlocked && !(await askPassword(cfg.system.password, 'los datos de la estación'))) { go('inicio'); return; }
  unlocked = true;
  const tab = state.tab || 'estacion';
  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Datos de la estación'), h('div', { class: 'sub' }, 'Identificación, correcciones del instrumental y valores extremos por parámetro'))));
  root.append(h('div', { class: 'tabs' }, [['estacion', 'Datos de la estación'], ['correcciones', 'Correcciones del instrumental'], ['limites', 'Valores extremos por parámetro']]
    .map(([id, t]) => h('button', { class: id === tab ? 'on' : '', onclick: () => go('estacion', { tab: id }) }, t))));

  const bind = (obj, k, opts = {}) => numInput(obj[k], { ...opts, oninput: (v) => { obj[k] = v === '' ? null : Number(v); } });
  const text = (obj, k, attrs = {}) => h('input', { class: 'inp', value: obj[k] ?? '', ...attrs, oninput: (e) => { obj[k] = e.target.value; } });
  const save = async (msg) => { await saveConfig(cfg); updateStationChip(); toast(msg || 'Cambios guardados'); };

  if (tab === 'estacion') {
    const s = cfg.station;
    root.append(card('Identificación', 'station', h('div', { class: 'fields wide' },
      field('Nombre de la estación', text(s, 'name')),
      field('Indicativo internacional (OMM)', text(s, 'index', { maxlength: 5, class: 'inp mono' }), 'Bloque y número, por ejemplo 87509.'),
      field('Código interno de la estación', text(s, 'code', { maxlength: 3, class: 'inp mono' }), 'Prefijo de los archivos del programa anterior.'))),
    card('Ubicación', 'folder', h('div', { class: 'fields' },
      field('Latitud (grados, Sur)', bind(s, 'latDeg', { unit: '°', step: '1' })),
      field('Latitud (minutos)', bind(s, 'latMin', { unit: '′', step: '1' })),
      field('Longitud (grados, Oeste)', bind(s, 'lonDeg', { unit: '°', step: '1' })),
      field('Longitud (minutos)', bind(s, 'lonMin', { unit: '′', step: '1' })),
      field('Altura del barómetro', bind(s, 'altitude', { unit: 'm', step: '1' }), 'Se usa para reducir la presión al nivel del mar.'),
      field('Huso horario (hora oficial)', bind(s, 'huso', { unit: 'h', step: '1' }), 'Argentina: −3.'))),
    card('Reducción de la presión', 'pressure', h('div', { class: 'fields' },
      field('Tabla', text(s, 'tabla', { class: 'inp mono' })),
      field('Presión media', bind(s, 'presMedia', { unit: 'mmHg' })),
      field('Tensión media de vapor', bind(s, 'tensMedia', { unit: 'hPa' })),
      field('Corrección por gravedad', bind(s, 'corrGrav', { unit: 'mmHg', step: '0.01' }), 'Solo barómetros de mercurio.'),
      field('Temperatura media para la reducción 555', bind(s, 'tReduc', { unit: '°C' }), 'Grupo nacional 1PPPP. Ajustado a los datos de San Rafael: 12,7 °C.'))),
    card('Boletín', 'code', h('div', { class: 'fields' },
      field('Encabezado (TTAAii)', text(s, 'bulletin', { class: 'inp mono' })),
      field('Centro (CCCC)', text(s, 'center', { class: 'inp mono' })),
      field('Dirección AFTN', text(s, 'aftn', { class: 'inp mono' })))),
    h('div', { class: 'row', style: { marginTop: '16px' } }, h('button', { class: 'btn primary lg', onclick: () => save('Datos de la estación guardados') }, icon('save'), 'Guardar')));
  }

  if (tab === 'correcciones') {
    const c = cfg.corrections;
    const tipo = select([['1', 'Fortin (mercurio, mmHg)'], ['2', 'Kew (mercurio, mmHg)'], ['3', 'Digital (hPa)']], c.baroTipo || '3', (v) => { c.baroTipo = v; unitLbl.textContent = v === '3' ? 'hPa' : 'mmHg'; }, { empty: null });
    const corrB = bind(c, 'baroCorr', { unit: c.baroTipo === '3' ? 'hPa' : 'mmHg', step: '0.1' });
    const unitLbl = corrB.querySelector('.u');
    root.append(card('Termómetros', 'thermo',
      h('div', { class: 'small muted', style: { marginBottom: '12px' } }, 'Corrección que se suma a cada lectura (según el certificado del instrumento).'),
      h('div', { class: 'fields' },
        field('Termómetro seco', bind(c, 'seco', { unit: '°C' })),
        field('Termómetro húmedo', bind(c, 'humedo', { unit: '°C' })),
        field('Termómetro de máxima', bind(c, 'max', { unit: '°C' })),
        field('Termómetro de mínima', bind(c, 'min', { unit: '°C' })),
        field('Termómetro de superficie', bind(c, 'sup', { unit: '°C' })),
        field('Termómetro a 0,5', bind(c, 'sup05', { unit: '°C' })))),
    card('Barómetro', 'pressure', h('div', { class: 'fields wide' },
      field('Tipo de barómetro', tipo), field('Corrección instrumental', corrB))),
    card('Vigencia', 'calendar', h('div', { class: 'fields' },
      field('Correcciones actualizadas al', h('input', { class: 'inp', type: 'date', value: c.fecha || '', oninput: (e) => { c.fecha = e.target.value; } })))),
    h('div', { class: 'row', style: { marginTop: '16px' } }, h('button', { class: 'btn primary lg', onclick: () => { if (!c.fecha) c.fecha = todayISO(); save('Correcciones guardadas'); } }, icon('save'), 'Guardar')));
  }

  if (tab === 'limites') {
    const L = cfg.limits;
    const row = (label, k, unit, hasMin = true, hasMax = true) => h('tr', {}, h('td', { class: 'l' }, label),
      h('td', {}, hasMax ? numInput(L.max[k], { unit, oninput: (v) => { L.max[k] = v === '' ? null : Number(v); } }) : '—'),
      h('td', {}, hasMin ? numInput(L.min[k], { unit, oninput: (v) => { L.min[k] = v === '' ? null : Number(v); } }) : '—'));
    root.append(card('Límites para el control de los datos', 'shield',
      h('div', { class: 'small muted', style: { marginBottom: '12px' } }, 'Los valores fuera de estos límites generan una advertencia al ingresar la observación.'),
      h('div', { class: 'tbl-wrap', style: { maxWidth: '720px' } }, h('table', { class: 'tbl' },
        h('thead', {}, h('tr', {}, h('th', { class: 'l' }, 'Parámetro'), h('th', {}, 'Máximo'), h('th', {}, 'Mínimo'))),
        h('tbody', {},
          row('Termómetro seco', 'seco', '°C'), row('Termómetro húmedo', 'humedo', '°C'), row('Presión en la estación', 'presion', 'hPa'),
          row('Temperatura máxima', 'tmax', '°C'), row('Temperatura mínima', 'tmin', '°C'),
          row('Viento', 'viento', 'kt', false, true), row('Humedad relativa', 'humedad', '%', true, false)))),
      L.fecha ? h('div', { class: 'small muted', style: { marginTop: '8px' } }, `Límites ingresados el ${fmtDate(L.fecha)}`) : null),
    h('div', { class: 'row', style: { marginTop: '16px' } }, h('button', { class: 'btn primary lg', onclick: () => { L.fecha = todayISO(); save('Límites guardados'); } }, icon('save'), 'Guardar')));
  }
}
