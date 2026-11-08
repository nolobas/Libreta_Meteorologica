import {
  h, icon, card, field, numInput, select, codeOptions, alertBox, toast, dialog, confirmDlg, nf, pad2, fmtDate, todayISO,
} from '../lib/ui.js';
import {
  getConfig, getObs, saveObs, deleteObs, contextFor, addHours, dayObs, lastEntry,
} from '../lib/store.js';
import { computeObs, encodeSynop, validateObs } from '../lib/synop.js';
import {
  WW, W_PAST, RUMBOS, N_OKTAS, H_BASE, CL, CM, CH, GENERO, DIR_0700, DIR_57, ANG_ELEV, TENDENCIA,
  ESTADO_SUELO, ESTADO_SUELO_NIEVE, EVAP_ESTADO, UNIDADES_VIENTO, INSTR_VIENTO, vvText, hshsText, metersToHshs, hshsToMeters, rumboFromDD,
} from '../lib/tables.js';
import { isNum } from '../lib/meteo.js';
import { nextHour } from './inicio.js';

const VV_OPTS = [...Array(100).keys()].filter((c) => c < 51 || c > 55).map((c) => [String(c), `${pad2(c)} — ${vvText(c)}`]);

/** Convierte una observación importada (solo SYNOP) en datos editables. */
function fromImported(o, cfg) {
  const v = o.v || {}; const c = cfg.corrections || {};
  const n = { ...o };
  if (v.T != null) n.dry = +(v.T - (Number(c.seco) || 0)).toFixed(1);
  if (v.Td != null) n.td = v.Td;
  if (v.Pst != null && String(c.baroTipo || '3') === '3') n.presReading = +(v.Pst - (Number(c.baroCorr) || 0)).toFixed(1);
  if (v.Tmax != null) n.tmax = +(v.Tmax - (Number(c.max) || 0)).toFixed(1);
  if (v.Tmin != null) n.tmin = +(v.Tmin - (Number(c.min) || 0)).toFixed(1);
  if (v.Tg != null) n.tsup = v.Tg;
  if (v.dd != null) n.windDir = rumboFromDD(v.dd);
  if (v.ff != null) { n.windSpeed = v.ff; n.windUnit = 'kt'; }
  for (const k of ['N', 'Nh', 'CL', 'CM', 'CH', 'ww', 'W1', 'W2', 'VV', 'E', 'Eprime']) if (v[k] != null) n[k] = v[k];
  if (v.h != null) n.hCode = v.h;
  if (v.a != null) n.tendA = v.a;
  if (v.RRR != null && Number(o.hour) !== 12) { if (v.RRRtrace) n.precipTrace = true; else if (v.RRR === 0) n.precipNone = true; else n.precipMm = v.RRR; }
  if (Number(o.hour) === 12 && v.RRR6 != null) { if (v.RRR6trace) n.precipTrace = true; else n.precipMm = v.RRR6; }
  if (Number(o.hour) === 12 && v.RRR === 0) n.precipNone = true;
  delete n.imported; delete n.v; delete n.synop;
  n.fromImport = true;
  return n;
}

export async function render(root, { state, setState, go }) {
  const cfg = getConfig(); const sys = cfg.system || {}; const corr = cfg.corrections || {};
  const huso = Number(cfg.station.huso ?? -3);
  let date = state.date; let hour = state.hour;
  if (date == null || hour == null) { const nx = nextHour(cfg, await lastEntry()); date = nx.date; hour = nx.hour; }
  hour = Number(hour);
  setState({ date, hour });

  const existing = await getObs(date, hour);
  let o = existing ? (existing.imported ? fromImported(existing, cfg) : structuredClone(existing)) : { date, hour };
  o.date = date; o.hour = hour;
  if (!o.windUnit) o.windUnit = sys.windUnit || 'kt';
  if (!o.windInstr) o.windInstr = sys.windInstr || '1';
  if (!Array.isArray(o.layers)) o.layers = [];
  let ctx = await contextFor(date, hour);
  let dirty = false;

  const isMain = (sys.mainHours || [0, 12]).includes(hour);
  const isPrecip = (sys.precipHours || [0, 6, 12, 18]).includes(hour);
  const is12 = hour === 12;
  const baroDigital = String(corr.baroTipo || '3') === '3';

  // ------------------------------------------------------------- encabezado
  root.append(h('div', { class: 'page-head' },
    h('div', {}, h('h1', {}, 'Libreta de observaciones'),
      h('div', { class: 'sub' }, 'Ingreso de la observación horaria, cálculos automáticos y codificación del mensaje SYNOP')),
    h('div', { class: 'actions' },
      h('span', { class: 'muted small' }, h('kbd', {}, 'Enter'), ' siguiente campo · ', h('kbd', {}, 'Ctrl'), '+', h('kbd', {}, 'S'), ' guardar'))));

  // ------------------------------------------------------------- selector de fecha y hora
  const day = await dayObs(date);
  const move = async (delta) => { const b = addHours(date, hour, delta); await leave() && go('libreta', { date: b.date, hour: b.hour }); };
  const leave = async () => !dirty || await confirmDlg('Cambios sin guardar', 'La observación tiene cambios sin guardar. ¿Desea descartarlos?', 'Descartar', true);
  const dateInp = h('input', { class: 'inp', type: 'date', value: date, max: '2100-12-31', style: { width: '160px' } });
  dateInp.addEventListener('change', async () => { if (dateInp.value && await leave()) go('libreta', { date: dateInp.value, hour }); else dateInp.value = date; });
  const statusTag = existing ? (existing.missing ? h('span', { class: 'tag warn' }, 'Registrada como faltante')
    : existing.imported ? h('span', { class: 'tag acc' }, 'Importada del programa anterior')
      : h('span', { class: 'tag ok' }, icon('check'), 'Ya ingresada')) : h('span', { class: 'tag' }, 'Nueva observación');
  root.append(h('section', { class: 'card', style: { marginBottom: '16px' } },
    h('div', { class: 'datebar' },
      field('Fecha (UTC)', dateInp),
      h('div', { class: 'row', style: { paddingBottom: '1px' } },
        h('button', { class: 'btn', title: 'Hora anterior', onclick: () => move(-1) }, icon('left')),
        h('div', { style: { minWidth: '160px', textAlign: 'center' } },
          h('div', { style: { fontSize: '20px', fontWeight: 600, lineHeight: '24px' } }, `${pad2(hour)} UTC`),
          h('div', { class: 'muted small' }, `${pad2((hour + huso + 24) % 24)}:00 hora oficial`)),
        h('button', { class: 'btn', title: 'Hora siguiente', onclick: () => move(1) }, icon('right'))),
      h('div', { class: 'row', style: { marginLeft: 'auto' } }, statusTag,
        isMain ? h('span', { class: 'tag acc' }, 'Hora principal') : null,
        h('button', { class: 'btn subtle', onclick: async () => { if (await leave()) go('libreta', { date: todayISO(), hour: new Date().getUTCHours() }); } }, icon('clock'), 'Ahora'))),
    h('div', { class: 'hours' }, day.map((d, i) => h('button', {
      class: [d ? (d.missing ? 'miss' : d.imported ? 'imp' : 'done') : '', i === hour ? 'sel' : '', (sys.mainHours || [0, 12]).includes(i) ? 'main' : ''].join(' '),
      title: `${pad2(i)} UTC${d ? (d.missing ? ' — faltante' : ' — ingresada') : ''}`,
      onclick: async () => { if (i !== hour && await leave()) go('libreta', { date, hour: i }); },
    }, pad2(i)))),
    h('div', { class: 'legend' },
      h('span', {}, h('i', { style: { background: 'var(--ok-soft)', border: '1px solid var(--ok)' } }), 'Ingresada'),
      h('span', {}, h('i', { style: { background: 'var(--accent-soft)', border: '1px solid var(--accent)' } }), 'Importada'),
      h('span', {}, h('i', { style: { background: 'var(--warn-soft)', border: '1px solid var(--warn)' } }), 'Faltante'),
      h('span', {}, h('i', { style: { background: 'var(--card)', border: '1px solid var(--stroke-2)' } }), 'Sin datos'),
      h('span', {}, '•  Hora principal (00 y 12 UTC)'))));

  if (existing?.imported) {
    root.append(h('div', { style: { marginBottom: '12px' } }, alertBox('info',
      'Esta observación proviene del programa anterior y solo contiene el mensaje SYNOP. Los códigos y valores se cargaron en el formulario; '
      + 'al guardar se recalcula el mensaje con los datos ingresados. Si no lo modifica, se conserva el mensaje original.')));
  }

  // ------------------------------------------------------------- formulario
  const form = h('div', {});
  const panel = h('div', { class: 'sticky' });
  root.append(h('div', { class: 'entry' }, form, panel));

  const set = (k, val) => { o[k] = val === '' ? null : val; dirty = true; schedule(); };
  const num = (k, opts = {}) => numInput(o[k], { ...opts, oninput: (v) => set(k, v) });
  const sel = (k, opts, extra) => select(opts, o[k], (v) => { set(k, v); extra && extra(v); });
  const descOf = (arr, k) => { const d = h('div', { class: 'desc' }); const upd = () => { d.textContent = isNum(o[k]) ? arr[Number(o[k])] || '' : ''; }; upd(); d.upd = upd; return d; };

  const toc = h('div', { class: 'toc no-print' });
  form.append(toc);
  const section = (id, title, ic, ...kids) => {
    toc.append(h('a', { href: '#', onclick: (e) => { e.preventDefault(); form.querySelector('#s-' + id).scrollIntoView({ behavior: 'smooth' }); } }, title));
    const c = card(title, ic, ...kids); c.id = 's-' + id; c.classList.add('sec-anchor'); form.append(c); return c;
  };

  // Presión
  const p3Txt = ctx.p3 != null ? `P. estación 3 h antes: ${nf(ctx.p3)} hPa` : 'No hay presión de 3 h antes: la tendencia no se calcula.';
  section('presion', 'Presión', 'pressure',
    h('div', { class: 'fields' },
      field(baroDigital ? 'Lectura del barómetro' : 'Lectura del barómetro (mercurio)', num('presReading', { unit: baroDigital ? 'hPa' : 'mmHg' }),
        baroDigital ? 'Barómetro digital: se suma la corrección instrumental.' : 'Se corrige por temperatura, gravedad e instrumento.'),
      baroDigital ? null : field('Termómetro adjunto', num('tAtt', { unit: '°C' })),
      h('div', { class: 'field span2' }, h('label', {}, 'Característica de la tendencia (a)'),
        sel('tendA', codeOptions(TENDENCIA)), h('div', { class: 'help' }, `Vacío = automática. ${p3Txt}`))));

  // Temperatura y humedad
  const iced = h('label', { class: 'check' }, h('input', { type: 'checkbox', checked: !!o.iced, onchange: (e) => set('iced', e.target.checked) }), 'Bulbo húmedo congelado');
  section('temp', 'Temperatura y humedad', 'thermo',
    h('div', { class: 'fields' },
      field('Termómetro seco', num('dry', { unit: '°C' })),
      field('Termómetro húmedo', num('wet', { unit: '°C' })),
      field('Punto de rocío (opcional)', num('td', { unit: '°C' }), 'Solo si no hay lectura del psicrómetro.'),
      h('div', { class: 'field', style: { justifyContent: 'flex-end', paddingBottom: '6px' } }, iced)));

  // Extremas y suelo
  if (isMain || is12) {
    section('extremas', 'Temperaturas extremas y del suelo', 'thermo',
      h('div', { class: 'fields' },
        isMain ? field('Termómetro de máxima', num('tmax', { unit: '°C' })) : null,
        isMain ? field('Termómetro de mínima', num('tmin', { unit: '°C' })) : null,
        is12 ? field('Termómetro de superficie (mínima)', num('tsup', { unit: '°C' }), 'Se informa en el grupo 3EsnTgTg.') : null,
        is12 ? field('Termómetro a 0,5', num('t05', { unit: '°C' })) : null));
  }

  // Viento
  const UNIT_LBL = { kt: 'kt', kmh: 'km/h', ms: 'm/s', bf: 'Bft' };
  const spd = numInput(o.windSpeed, { unit: UNIT_LBL[o.windUnit], oninput: (v) => set('windSpeed', v) });
  const gustDir = select(RUMBOS.filter((r) => r.dd !== 0).map((r) => [r.code, `${r.code} — ${r.name}`]), o.gustDir, (v) => set('gustDir', v));
  section('viento', 'Viento', 'wind',
    h('div', { class: 'fields' },
      field('Dirección (16 rumbos)', sel('windDir', RUMBOS.map((r) => [r.code, `${r.code === 'C' ? '' : r.code + ' — '}${r.name}${r.dd && r.dd !== 99 ? ` (${pad2(r.dd)})` : ''}`]), (v) => {
        if (v === 'C') { o.windSpeed = 0; spd.input.value = '0'; }
      })),
      field('Velocidad', spd),
      field('Unidad', sel('windUnit', UNIDADES_VIENTO.map((u) => [u.code, u.name]), (v) => { spd.querySelector('.u').textContent = UNIT_LBL[v] || ''; })),
      field('Instrumento', sel('windInstr', INSTR_VIENTO.map((u) => [u.code, u.name]))),
      field('Ráfaga máx. hora precedente — dirección', gustDir),
      field('Ráfaga máx. — velocidad', num('gustSpeed', { unit: 'misma unidad' }))));

  // Nubosidad
  const dN = descOf(N_OKTAS, 'N'); const dCL = descOf(CL, 'CL'); const dCM = descOf(CM, 'CM'); const dCH = descOf(CH, 'CH'); const dH = descOf(H_BASE, 'hCode');
  const hSel = sel('hCode', codeOptions(H_BASE), () => dH.upd());
  const layersBox = h('div', { class: 'layers' });
  const drawLayers = () => {
    layersBox.replaceChildren(...o.layers.map((L, i) => {
      const hm = numInput(L.hm ?? '', { unit: 'm', oninput: (v) => { L.hm = v; L.hshs = isNum(v) ? metersToHshs(Number(v)) : null; info.textContent = L.hshs != null ? `hshs = ${pad2(L.hshs)} (${hshsText(L.hshs)})` : ''; dirty = true; schedule(); } });
      const info = h('div', { class: 'help' }, L.hshs != null ? `hshs = ${pad2(L.hshs)} (${hshsText(L.hshs)})` : '');
      return h('div', { class: 'layer-row' },
        field(`Capa ${i + 1} — octavos (Ns)`, select([...Array(10).keys()].map((k) => [String(k), k === 9 ? '9 — cielo invisible' : `${k}/8`]), L.Ns, (v) => { L.Ns = v === '' ? null : Number(v); dirty = true; schedule(); })),
        field('Género (C)', select(codeOptions(GENERO), L.C, (v) => { L.C = v === '' ? null : Number(v); dirty = true; schedule(); })),
        h('div', { class: 'field' }, h('label', {}, 'Altura de la base'), hm, info),
        h('button', { class: 'btn subtle', title: 'Quitar capa', onclick: () => { o.layers.splice(i, 1); dirty = true; drawLayers(); schedule(); } }, icon('trash')));
    }));
  };
  o.layers.forEach((L) => { if ((L.hm == null || L.hm === '') && L.hshs != null) L.hm = hshsToMeters(L.hshs); });
  drawLayers();
  section('nubes', 'Nubosidad', 'cloud',
    h('div', { class: 'fields wide' },
      h('div', { class: 'field' }, h('label', {}, 'Total de nubes (N)'), sel('N', codeOptions(['Despejado', '1/8', '2/8', '3/8', '4/8', '5/8', '6/8', '7/8', 'Cubierto', 'Cielo invisible']), () => dN.upd()), dN),
      h('div', { class: 'field' }, h('label', {}, 'Cantidad de nubes bajas o medias (Nh)'), sel('Nh', codeOptions(['0', '1/8', '2/8', '3/8', '4/8', '5/8', '6/8', '7/8', '8/8', 'Cielo invisible']))),
      h('div', { class: 'field' }, h('label', {}, 'Nubes bajas (CL)'), sel('CL', codeOptions(CL), () => dCL.upd()), dCL),
      h('div', { class: 'field' }, h('label', {}, 'Nubes medias (CM)'), sel('CM', codeOptions(CM), () => dCM.upd()), dCM),
      h('div', { class: 'field' }, h('label', {}, 'Nubes altas (CH)'), sel('CH', codeOptions(CH), () => dCH.upd()), dCH),
      h('div', { class: 'field' }, h('label', {}, 'Altura de la base de la nube más baja (h)'), hSel, dH)),
    h('hr', { class: 'sep' }),
    h('div', { class: 'row', style: { marginBottom: '8px' } }, h('h3', { style: { margin: 0 } }, 'Capas de nubes — grupos 8NsChshs (sección 333)'), h('span', { class: 'spacer' }),
      h('button', { class: 'btn', onclick: () => { o.layers.push({ Ns: null, C: null, hshs: null }); dirty = true; drawLayers(); } }, icon('plus'), 'Agregar capa')),
    layersBox,
    h('hr', { class: 'sep' }),
    h('div', { class: 'fields wide' },
      field('Dirección de nubes bajas (DL) — grupo 56', sel('DL', codeOptions(DIR_0700))),
      field('Dirección de nubes medias (DM)', sel('DM', codeOptions(DIR_0700))),
      field('Dirección de nubes altas (DH)', sel('DH', codeOptions(DIR_0700))),
      field('Nube orográfica / desarrollo vertical (C) — grupo 57', sel('c57C', codeOptions(GENERO))),
      field('Dirección en que se la ve (Da)', sel('c57Da', codeOptions(DIR_57))),
      field('Ángulo de elevación de la cima (ec)', sel('c57ec', codeOptions(ANG_ELEV)))));

  // Tiempo presente y pasado
  const dWW = descOf(WW, 'ww');
  const prevTxt = ctx.prev.map((p) => `${pad2(p.hour)}Z: ${p.ww != null ? pad2(p.ww) : p.exists ? '—' : 's/r'}`).join(' · ');
  section('tiempo', 'Tiempo presente y pasado', 'rain',
    h('div', { class: 'fields wide' },
      h('div', { class: 'field span2' }, h('label', {}, 'Tiempo presente (ww)'), sel('ww', WW.map((t, i) => [String(i), `${pad2(i)} — ${t}`]), () => dWW.upd()),
        h('div', { class: 'help' }, `Tiempo presente de las horas anteriores — ${prevTxt} (s/r = sin registro)`)),
      field('Tiempo pasado W1', sel('W1', codeOptions(W_PAST))),
      field('Tiempo pasado W2', sel('W2', codeOptions(W_PAST)))));

  // Visibilidad y suelo
  section('visib', 'Visibilidad y estado del suelo', 'eye',
    h('div', { class: 'fields wide' },
      field('Visibilidad horizontal (VV)', sel('VV', VV_OPTS)),
      is12 ? field('Estado del suelo sin nieve (E)', sel('E', codeOptions(ESTADO_SUELO))) : null,
      is12 ? field('Estado del suelo con nieve o hielo (E′)', sel('Eprime', codeOptions(ESTADO_SUELO_NIEVE)), 'Si se completa, se informa el grupo 4E′sss.') : null,
      is12 ? field('Altura de la nieve', num('snowCm', { unit: 'cm' }), '997 = menos de 0,5 cm · 998 = capa no continua · 999 = medición imposible') : null));

  // Precipitación
  if (isPrecip) {
    const mode = o.precipNone ? 'none' : o.precipTrace ? 'trace' : isNum(o.precipMm) ? 'mm' : '';
    const mmInp = numInput(o.precipMm, { unit: 'mm', oninput: (v) => { set('precipMm', v); } });
    const seg = h('div', { class: 'seg' });
    const setMode = (m) => {
      o.precipNone = m === 'none'; o.precipTrace = m === 'trace';
      if (m !== 'mm') { o.precipMm = null; mmInp.input.value = ''; }
      mmInp.input.disabled = m !== 'mm';
      for (const b of seg.children) b.classList.toggle('on', b.dataset.m === m);
      dirty = true; schedule();
    };
    [['none', 'No hubo'], ['trace', 'Inapreciable (< 0,1 mm)'], ['mm', 'Medida']].forEach(([m, t]) => seg.append(h('button', { 'data-m': m, class: mode === m ? 'on' : '', onclick: () => setMode(m) }, t)));
    mmInp.input.disabled = mode !== 'mm';
    const prevBox = is12 && ctx.precipPrev ? h('div', { class: 'small muted', style: { marginTop: '10px' } },
      'Mediciones anteriores desde las 12 UTC del día anterior: ',
      ctx.precipPrev.map((p) => `${pad2(p.hour)}Z ${p.exists ? (p.trace ? 'inap.' : p.mm != null ? nf(p.mm) + ' mm' : '0') : 's/r'}`).join(' · ')) : null;
    section('precip', 'Precipitación', 'drop',
      h('div', { class: 'small muted', style: { marginBottom: '10px' } }, is12
        ? 'Medición de las 12 UTC (últimas 6 horas). El total de 24 horas se calcula sumando las mediciones de 18, 00 y 06 UTC.'
        : 'Precipitación caída desde la última medición (6 horas).'),
      h('div', { class: 'row' }, seg, h('div', { style: { width: '160px' } }, mmInp)),
      prevBox);
  }

  // Datos diarios de las 12 UTC
  if (is12) {
    section('diarios', 'Datos diarios (12 UTC)', 'sun',
      h('div', { class: 'fields wide' },
        sys.evaporacion !== false ? field('Evaporación del día anterior', num('evap', { unit: '0,1 mm', step: '1' }), 'En décimos de milímetro (grupo 555 4iEEEE). Deje vacío si falta el dato.') : null,
        sys.evaporacion !== false ? field('Estado de la planta de evaporación', sel('evapEstado', EVAP_ESTADO.map((e) => [e.code, `${e.code} — ${e.text}`]))) : null,
        sys.freatimetro ? field('Nivel de la napa freática (12 UTC)', num('napa', { unit: 'cm', step: '1' }), 'Ej.: 17,60 m → 1760 cm. Se guarda en la libreta.') : null));
  }

  // Grupos adicionales
  section('extra', 'Grupos adicionales y notas', 'code',
    h('div', { class: 'fields wide' },
      field('Grupos adicionales sección 333', h('input', { class: 'inp mono', value: o.extra333 || '', placeholder: 'p. ej. 90002 90081', oninput: (e) => set('extra333', e.target.value) }), 'Grupos 9SpSpspsp u otros que no se generan automáticamente.'),
      field('Grupos adicionales sección 555', h('input', { class: 'inp mono', value: o.extra555 || '', placeholder: 'p. ej. 6///2 71410 74210', oninput: (e) => set('extra555', e.target.value) }), 'Grupos nacionales adicionales.'),
      field('Hora UTC real de la observación', h('input', { class: 'inp', type: 'time', value: o.realTime || '', oninput: (e) => set('realTime', e.target.value) }), 'Solo si se observó a una hora distinta de la correspondiente.'),
      h('div', { class: 'field span2' }, h('label', {}, 'Notas del observador'), h('textarea', { class: 'inp', rows: 2, oninput: (e) => set('notes', e.target.value) }, o.notes || ''))));

  // ------------------------------------------------------------- panel derecho
  const kv = h('div', { class: 'kv' });
  const checks = h('div', { class: 'alerts' });
  const synBox = h('div', { class: 'synop-box' });
  let manual = !!o.synopManual; let lastAuto = '';
  const synEdit = h('textarea', { class: 'inp mono', rows: 4, style: { display: manual ? 'block' : 'none', fontSize: '13px' } }, o.synop || '');
  synEdit.addEventListener('input', () => { dirty = true; });
  const manualChk = h('label', { class: 'check small' }, h('input', { type: 'checkbox', checked: manual, onchange: (e) => {
    manual = e.target.checked; synEdit.style.display = manual ? 'block' : 'none'; synBox.style.display = manual ? 'none' : 'block';
    if (manual && !synEdit.value.trim()) synEdit.value = lastAuto; dirty = true;
  } }), 'Editar el mensaje manualmente');
  synBox.style.display = manual ? 'none' : 'block';

  const saveBtn = h('button', { class: 'btn primary lg', style: { flex: 1 }, onclick: () => doSave(false) }, icon('save'), 'Guardar');
  const saveNext = h('button', { class: 'btn lg', title: 'Guardar y pasar a la hora siguiente', onclick: () => doSave(true) }, 'Guardar y seguir', icon('right'));
  panel.append(
    card('Valores calculados', 'chart', kv),
    card('Controles', 'shield', checks),
    h('section', { class: 'card' },
      h('div', { class: 'card-title' }, h('div', { class: 'ic' }, icon('code')), h('h3', {}, 'Mensaje SYNOP'),
        h('button', { class: 'btn subtle', style: { marginLeft: 'auto' }, title: 'Copiar', onclick: () => { navigator.clipboard.writeText(manual ? synEdit.value : synBox.textContent); toast('Mensaje copiado'); } }, icon('copy'), 'Copiar')),
      synBox, synEdit, h('div', { style: { marginTop: '8px' } }, manualChk)),
    h('div', { class: 'row' }, saveBtn, saveNext),
    h('div', { class: 'row' },
      h('button', { class: 'btn', onclick: markMissing }, icon('warn'), 'Registrar como faltante'),
      existing ? h('button', { class: 'btn danger', onclick: doDelete }, icon('trash'), 'Eliminar') : null));

  let lastV = null; let lastSyn = '';
  let timer = null;
  function schedule() { clearTimeout(timer); timer = setTimeout(recalc, 120); }
  function row(k, v, u = '') { return [h('div', { class: 'k' }, k), h('div', { class: 'v' }, v == null || v === '' ? '—' : `${v}${u}`)]; }
  function recalc() {
    const v = computeObs(o, cfg, ctx);
    const syn = encodeSynop(o, v, cfg);
    lastV = v; lastAuto = syn.text;
    const unchangedImport = existing?.imported && !dirty;
    lastSyn = unchangedImport ? existing.synop : syn.text;
    kv.replaceChildren(
      ...row('Presión en la estación', v.Pst != null ? nf(v.Pst) : null, ' hPa'),
      ...row('Presión al nivel del mar', v.Pmsl != null ? nf(v.Pmsl) : null, ' hPa'),
      ...row('Presión reducida (555)', v.Pnac != null ? nf(v.Pnac) : null, ' hPa'),
      ...row('Tendencia 3 h', v.dP3 != null ? `${v.dP3 >= 0 ? '+' : ''}${nf(v.dP3)} hPa · a=${v.a ?? '—'}` : null),
      ...row('Temperatura', v.T != null ? nf(v.T) : null, ' °C'),
      ...row('Punto de rocío', v.Td != null ? nf(v.Td) : null, ' °C'),
      ...row('Humedad relativa', v.HR != null ? nf(v.HR, 0) : null, ' %'),
      ...row('Tensión de vapor', v.e != null ? nf(v.e) : null, ' hPa'),
      ...row('Sensación térmica', v.ST != null ? nf(v.ST) : null, ' °C'),
      ...row('Viento', v.ff != null ? (v.ff === 0 ? 'Calma' : `${rumboFromDD(v.dd) || '—'} ${v.ff} kt · ${nf(v.ffKmh, 0)} km/h`) : null),
      ...(isMain ? row('Máxima / mínima', v.Tmax != null || v.Tmin != null ? `${nf(v.Tmax)} / ${nf(v.Tmin)}` : null, ' °C') : []),
      ...(v.RRR != null ? row(`Precipitación (${v.tR === 4 ? '24 h' : '6 h'})`, v.RRRtrace ? 'Inapreciable' : nf(v.RRR), v.RRRtrace ? '' : ' mm') : []),
    );
    synBox.replaceChildren(...colorSynop(lastSyn));
    const val = validateObs(o, v, cfg);
    checks.replaceChildren(...(val.errs.length || val.warns.length
      ? [...val.errs.map((e) => alertBox('err', e)), ...val.warns.map((w) => alertBox('warn', w))]
      : [alertBox('ok', v.T == null && v.Pst == null ? 'Complete los datos de la observación.' : 'No se encontraron inconsistencias.')]));
    checks.val = val;
  }
  recalc();

  async function doSave(andNext) {
    clearTimeout(timer); recalc();
    const val = checks.val;
    if (val.errs.length) {
      const ok = await dialog({ title: 'Hay inconsistencias', body: h('div', { class: 'alerts' }, ...val.errs.map((e) => alertBox('err', e)), h('p', { class: 'muted' }, '¿Desea guardar de todos modos?')),
        buttons: [{ label: 'Revisar', value: false, primary: true }, { label: 'Guardar igual', value: true }] });
      if (!ok) return;
    }
    if (lastV.T == null && lastV.Pst == null && lastV.ff == null && !manual) {
      toast('La observación no tiene datos. Use "Registrar como faltante" si corresponde.', 'err'); return;
    }
    const rec = { ...o, v: lastV, synop: manual ? synEdit.value.trim() : lastSyn, synopManual: manual, missing: false };
    if (existing?.imported && !dirty) { rec.imported = true; rec.v = existing.v; rec.synop = existing.synop; }
    delete rec.fromImport;
    await saveObs(rec);
    dirty = false;
    toast(`Observación de las ${pad2(hour)} UTC guardada`);
    if (andNext) { const b = addHours(date, hour, 1); go('libreta', { date: b.date, hour: b.hour }); } else go('libreta', { date, hour });
  }
  async function markMissing() {
    if (!await confirmDlg('Registrar como faltante', `Se registrará la observación del ${fmtDate(date)} a las ${pad2(hour)} UTC como faltante.`, 'Registrar')) return;
    await saveObs({ date, hour, missing: true, v: {}, synop: '', notes: o.notes || '' });
    dirty = false; toast('Registrada como faltante');
    const b = addHours(date, hour, 1); go('libreta', { date: b.date, hour: b.hour });
  }
  async function doDelete() {
    if (!await confirmDlg('Eliminar observación', `¿Eliminar la observación del ${fmtDate(date)} a las ${pad2(hour)} UTC? Esta acción no se puede deshacer.`, 'Eliminar', true)) return;
    await deleteObs(date, hour); dirty = false; toast('Observación eliminada'); go('libreta', { date, hour });
  }

  const onKey = (e) => {
    if (!document.body.contains(root)) { document.removeEventListener('keydown', onKey); return; }
    if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 's') { e.preventDefault(); doSave(false); }
    if (e.key === 'F3') { e.preventDefault(); go('libreta', { date, hour }); }
  };
  document.addEventListener('keydown', onKey);
  setTimeout(() => { const f = form.querySelector('input.inp'); if (f && !existing) f.focus(); }, 50);
}

function colorSynop(text) {
  const out = [];
  String(text || '').split(/(\s+)/).forEach((t) => {
    if (t === '333' || t === '555' || t.startsWith('AAXX')) out.push(h('span', { class: 'sec' }, t));
    else out.push(t);
  });
  return out.length ? out : ['—'];
}
