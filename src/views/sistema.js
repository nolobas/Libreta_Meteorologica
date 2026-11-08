import { h, icon, card, field, numInput, select, toast, askPassword } from '../lib/ui.js';
import { getConfig, saveConfig } from '../lib/store.js';
import { UNIDADES_VIENTO, INSTR_VIENTO } from '../lib/tables.js';

export async function render(root, { go }) {
  const cfg = structuredClone(getConfig()); const s = cfg.system;
  if (!(await askPassword(s.password, 'la configuración del sistema'))) { go('inicio'); return; }
  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Configuración del sistema'), h('div', { class: 'sub' }, 'Información solicitada por el sistema: instrumental disponible, unidades, horarios y clave de acceso'))));

  const chk = (k, label) => h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!s[k], onchange: (e) => { s[k] = e.target.checked; } }), label);
  const hoursPick = (k) => h('div', { class: 'row' }, [...Array(24).keys()].filter((x) => x % 3 === 0).map((hh) => h('label', { class: 'check small' },
    h('input', { type: 'checkbox', checked: (s[k] || []).includes(hh), onchange: (e) => { const set = new Set(s[k] || []); e.target.checked ? set.add(hh) : set.delete(hh); s[k] = [...set].sort((a, b) => a - b); } }), `${String(hh).padStart(2, '0')}Z`)));
  const pw = h('input', { class: 'inp', type: 'password', value: s.password || '', autocomplete: 'new-password', oninput: (e) => { s.password = e.target.value; } });

  root.append(
    card('Instrumental de la estación', 'gauge', h('div', { class: 'fields wide' },
      field('Unidades del barógrafo', select([['1', 'mmHg'], ['2', 'hPa'], ['3', 'No tiene barógrafo']], s.barografoUnidad || '2', (v) => { s.barografoUnidad = v; }, { empty: null })),
      field('Altura de la pista', numInput(s.pistaAlt, { unit: 'm', step: '1', oninput: (v) => { s.pistaAlt = v; } })),
      h('div', { class: 'field', style: { gap: '10px', justifyContent: 'center' } },
        chk('freatimetro', 'Posee freatímetro'), chk('evaporacion', 'Posee planta de evaporación'), chk('heliofanografo', 'Posee heliofanógrafo')))),
    card('Viento', 'wind', h('div', { class: 'fields wide' },
      field('Unidad habitual de medición', select(UNIDADES_VIENTO.map((u) => [u.code, u.name]), s.windUnit || 'kt', (v) => { s.windUnit = v; }, { empty: null })),
      field('Instrumento habitual', select(INSTR_VIENTO.map((u) => [u.code, u.name]), s.windInstr || '1', (v) => { s.windInstr = v; }, { empty: null })),
      field('Indicador iw del SYNOP', select([['1', '1 — m/s estimado'], ['3', '3 — nudos estimado'], ['4', '4 — nudos medido con anemómetro']], s.iw || '4', (v) => { s.iw = v; }, { empty: null })))),
    card('Horarios', 'clock',
      field('Horas principales (máxima y mínima en la sección 333)', hoursPick('mainHours')),
      h('div', { style: { height: '12px' } }),
      field('Horas de medición de la precipitación', hoursPick('precipHours'), 'A las 12 UTC se informa el total de 24 horas.')),
    card('Seguridad', 'lock', h('div', { class: 'fields wide' },
      field('Clave de acceso', pw, 'Si se define, se pide para entrar a Datos de la estación, Configuración y Administración. Déjela vacía para no usar clave.'))),
    h('div', { class: 'row', style: { marginTop: '16px' } }, h('button', { class: 'btn primary lg', onclick: async () => { await saveConfig(cfg); toast('Configuración guardada'); } }, icon('save'), 'Guardar')));
}
