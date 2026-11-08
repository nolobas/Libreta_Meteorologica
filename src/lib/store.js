// Acceso a los datos (archivos JSON mensuales en la carpeta de datos).
import { defaultConfig, computeObs, encodeSynop } from './synop.js';

const api = window.api;
const cache = new Map(); // 'obs/2026-11' -> objeto

const pad2 = (n) => String(n).padStart(2, '0');
export const ymOf = (date) => date.slice(0, 7);
export const keyOf = (date, hour) => `${date.slice(8, 10)}-${pad2(hour)}`;

export function addHours(date, hour, delta) {
  const d = new Date(`${date}T${pad2(hour)}:00:00Z`);
  d.setUTCHours(d.getUTCHours() + delta);
  return { date: d.toISOString().slice(0, 10), hour: d.getUTCHours() };
}
export function addDays(date, delta) {
  const d = new Date(`${date}T12:00:00Z`); d.setUTCDate(d.getUTCDate() + delta);
  return d.toISOString().slice(0, 10);
}
export function daysInMonth(ym) { const [y, m] = ym.split('-').map(Number); return new Date(Date.UTC(y, m, 0)).getUTCDate(); }

// ---------------------------------------------------------------- configuración
let config = null;
function deepMerge(base, over) {
  const out = { ...base };
  for (const [k, v] of Object.entries(over || {})) {
    out[k] = v && typeof v === 'object' && !Array.isArray(v) && base[k] && typeof base[k] === 'object' ? deepMerge(base[k], v) : v;
  }
  return out;
}
export async function loadConfig() {
  const c = await api.read('config.json');
  config = deepMerge(defaultConfig(), c || {});
  config._new = !c;
  return config;
}
export function getConfig() { return config; }
export async function saveConfig(c) {
  const { _new, ...rest } = c;
  config = { ...rest };
  await api.write('config.json', config);
  return config;
}

// ---------------------------------------------------------------- observaciones
export async function loadMonth(kind, ym) {
  const k = `${kind}/${ym}`;
  if (!cache.has(k)) cache.set(k, (await api.read(`${k}.json`)) || {});
  return cache.get(k);
}
export function invalidate() { cache.clear(); }
async function saveMonth(kind, ym) {
  await api.write(`${kind}/${ym}.json`, cache.get(`${kind}/${ym}`) || {});
}

export async function getObs(date, hour) {
  const m = await loadMonth('obs', ymOf(date));
  return m[keyOf(date, hour)] || null;
}

/** Valores de contexto para calcular una observación (T 12 h antes, P 3 h antes, lluvias previas). */
export async function contextFor(date, hour) {
  const ctx = {};
  const b12 = addHours(date, hour, -12);
  const o12 = await getObs(b12.date, b12.hour);
  if (o12 && o12.v && o12.v.T != null) ctx.t12 = o12.v.T;
  const b3 = addHours(date, hour, -3);
  const o3 = await getObs(b3.date, b3.hour);
  if (o3 && o3.v && o3.v.Pst != null) ctx.p3 = o3.v.Pst;
  ctx.prev = [];
  for (let i = 1; i <= 3; i++) {
    const b = addHours(date, hour, -i);
    const o = await getObs(b.date, b.hour);
    ctx.prev.push({ hour: b.hour, ww: o?.v?.ww ?? null, missing: !!o?.missing, exists: !!o });
  }
  if (Number(hour) === 12) {
    ctx.precipPrev = [];
    for (const back of [18, 12, 6]) {
      const b = addHours(date, hour, -back);
      const o = await getObs(b.date, b.hour);
      ctx.precipPrev.push({ hour: b.hour, mm: o?.v?.prMm ?? (o?.imported ? (o.v?.RRR ?? null) : null), trace: !!(o?.v?.prTrace || (o?.imported && o.v?.RRRtrace)), exists: !!o });
    }
  }
  return ctx;
}

export async function saveObs(o) {
  const ym = ymOf(o.date);
  const m = await loadMonth('obs', ym);
  o.savedAt = new Date().toISOString();
  m[keyOf(o.date, o.hour)] = o;
  await saveMonth('obs', ym);
  await api.write('estado.json', { ultima: { date: o.date, hour: o.hour, savedAt: o.savedAt } });
  return o;
}

export async function deleteObs(date, hour) {
  const ym = ymOf(date);
  const m = await loadMonth('obs', ym);
  delete m[keyOf(date, hour)];
  await saveMonth('obs', ym);
}

export async function listMonths(kind = 'obs') {
  return (await api.list(kind)).map((f) => f.replace('.json', ''));
}

/** Última observación cargada (la de fecha/hora más reciente). */
export async function lastObs() {
  const months = await listMonths('obs');
  for (let i = months.length - 1; i >= 0; i--) {
    const m = await loadMonth('obs', months[i]);
    const keys = Object.keys(m).sort();
    for (let j = keys.length - 1; j >= 0; j--) {
      const o = m[keys[j]];
      if (o && !o.missing) return o;
    }
  }
  return null;
}
export async function lastEntry() {
  const months = await listMonths('obs');
  for (let i = months.length - 1; i >= 0; i--) {
    const m = await loadMonth('obs', months[i]);
    const keys = Object.keys(m).sort();
    if (keys.length) return m[keys[keys.length - 1]];
  }
  return null;
}

/** Observaciones de un día (UTC) → arreglo de 24 posiciones */
export async function dayObs(date) {
  const m = await loadMonth('obs', ymOf(date));
  return Array.from({ length: 24 }, (_, h) => m[keyOf(date, h)] || null);
}

/** Observaciones de un día en hora oficial (01..24 HOA) */
export async function dayObsLocal(date, huso = -3) {
  const out = [];
  for (let hl = 1; hl <= 24; hl++) {
    const u = addHours(date, hl, -huso);
    out.push({ hl, ...u, o: await getObs(u.date, u.hour) });
  }
  return out;
}

export async function recompute(o, cfg) {
  const ctx = await contextFor(o.date, o.hour);
  const v = computeObs(o, cfg, ctx);
  const syn = encodeSynop(o, v, cfg);
  return { v, synop: syn.text, ctx };
}

// ---------------------------------------------------------------- registradores y diarios
export async function getReg(date) { const m = await loadMonth('reg', ymOf(date)); return m[date] || null; }
export async function saveReg(date, rec) {
  const ym = ymOf(date); const m = await loadMonth('reg', ym);
  m[date] = { ...rec, savedAt: new Date().toISOString() }; delete m[date].imported;
  await saveMonth('reg', ym);
}
export async function getDia(date) { const m = await loadMonth('dia', ymOf(date)); return m[date] || null; }
export async function saveDia(date, rec) {
  const ym = ymOf(date); const m = await loadMonth('dia', ym);
  m[date] = { ...rec, savedAt: new Date().toISOString() };
  await saveMonth('dia', ym);
}
