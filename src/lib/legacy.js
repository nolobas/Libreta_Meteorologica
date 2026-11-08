// Lectura de los archivos del programa LIBRETA original (MS-DOS / QuickBASIC).
// Todas las funciones reciben el contenido como texto (latin1 / cp850) y no usan el disco.
import { decodeSynop } from './synop.js';

const unq = (s) => String(s ?? '').replace(/^"|"$/g, '').trim();
const csv = (txt) => {
  const line = String(txt).split(/\r?\n|\r/).find((l) => l.trim());
  return line ? (line.match(/"[^"]*"|[^,]+/g) || []).map(unq) : [];
};
const nOr = (x, d = null) => (x === '' || x == null || Number.isNaN(Number(x)) ? d : Number(x));

/** ARCH/ESTAC.DAT → datos de la estación */
export function parseEstac(txt) {
  const f = csv(txt);
  if (f.length < 11) return null;
  return {
    code: f[0], latDeg: nOr(f[1]), latMin: nOr(f[2]), lonDeg: nOr(f[3]), lonMin: nOr(f[4]),
    altitude: nOr(f[5]), tabla: f[6], presMedia: nOr(f[7]), tensMedia: nOr(f[8]), corrGrav: nOr(f[9], 0),
    index: f[10], fecha: f[11] ? `${f[13]}-${f[12]}-${f[11]}` : '', name: (f[14] || '').trim(),
  };
}

/** ARCH/CORREC.DAT → correcciones del instrumental (se toma la primera línea, la vigente) */
export function parseCorrec(txt) {
  const f = csv(txt);
  if (f.length < 9) return null;
  return {
    seco: nOr(f[0], 0), humedo: nOr(f[1], 0), max: nOr(f[2], 0), min: nOr(f[3], 0), sup: nOr(f[4], 0), sup05: nOr(f[5], 0),
    meridiano: f[6], baroTipo: f[7] || '3', baroCorr: nOr(f[8], 0), fecha: f[11] ? `${f[11]}-${f[10]}-${f[9]}` : '',
  };
}

/** ARCH/LIMT.DAT → límites de los parámetros (presión en mmHg en el original) */
export function parseLimt(txt) {
  const f = csv(txt);
  if (f.length < 12) return null;
  const mm = (x) => (nOr(x) == null ? null : Math.round(nOr(x) * 1.333224));
  return {
    max: { seco: nOr(f[0]), humedo: nOr(f[1]), presion: mm(f[2]), tmax: nOr(f[3]), tmin: nOr(f[4]), viento: nOr(f[5]) },
    min: { seco: nOr(f[6]), humedo: nOr(f[7]), presion: mm(f[8]), tmax: nOr(f[9]), tmin: nOr(f[10]), humedad: nOr(f[11]) },
    fecha: f[14] ? `${f[14]}-${f[13]}-${f[12]}` : '',
  };
}

/**
 * DAT/SYN/*.SYN → mensajes SYNOP.
 * Registros de 103 bytes separados por CR: clave (estación 3, año 4, mes 2, día 2, hora 2)
 * + identificador de sección (01111, 03333, 03336, 05555, 05556) + grupos.
 */
export function parseSynFile(txt) {
  const recs = new Map();
  for (const raw of String(txt).split(/\r\n|\r|\n/)) {
    if (raw.length < 18 || !/^\d{13}/.test(raw)) continue;
    const key = raw.slice(0, 13); const sec = raw.slice(13, 18); const body = raw.slice(18).trim();
    if (!recs.has(key)) recs.set(key, {});
    recs.get(key)[sec] = body;
  }
  const out = [];
  for (const [key, s] of recs) {
    const s1 = s['01111'];
    if (!s1) continue;
    const yyggi = s1.split(/\s+/)[0] || '';
    let body = s1.split(/\s+/).slice(1).join(' ');
    const s3 = [s['03333'], s['03336']].filter(Boolean).join(' ').replace(/^333\s*/, '').trim();
    const s5 = [s['05555'], s['05556']].filter(Boolean).join(' ').replace(/^555\s*/, '').trim();
    if (s3) body += ' 333 ' + s3;
    if (s5) body += ' 555 ' + s5;
    const station = key.slice(0, 3); const date = `${key.slice(3, 7)}-${key.slice(7, 9)}-${key.slice(9, 11)}`;
    const hour = Number(key.slice(11, 13));
    const text = `AAXX ${yyggi}\n${body}=`;
    out.push({ station, date, hour, text });
  }
  return out;
}

export function synRecordToObs(rec) {
  const d = decodeSynop(rec.text);
  return {
    date: rec.date, hour: rec.hour, imported: true, source: 'LIBRETA', synop: rec.text,
    ...d.o, v: d.v,
  };
}

/**
 * DAT/GRAF/*.TE1|TE2|HI1|HI2|BA1|BA2|HE1|HE2 → valores horarios de registradores.
 * Clave de 15 caracteres: estación(3) año(4) mes(2) día(2) huso(1) parámetro(2) mitad(1)
 * mitad 1 = horas 01–12, 2 = horas 13–24 (hora oficial).
 */
const GRAF_BY_CODE = { '01': ['termo', 5], '02': ['higro', 3], '03': ['baro', 6], '04': ['helio', 3] };
const MISSING = new Set([-77.7, -77, -0.7, -777.7, -7.7, -666, -66.6]);
export function parseGrafFile(txt, ext) {
  const half = Number(ext[2]);
  const out = [];
  for (const raw of String(txt).split(/\r\n|\r|\n/)) {
    if (raw.length < 18 || !/^\d{15}/.test(raw)) continue;
    // el código de parámetro de la clave manda (algunos archivos tienen la extensión cambiada)
    const def = GRAF_BY_CODE[raw.slice(12, 14)];
    if (!def) continue;
    const [param, w] = def;
    const hf = Number(raw[14]) || half;
    const date = `${raw.slice(3, 7)}-${raw.slice(7, 9)}-${raw.slice(9, 11)}`;
    const vals = [];
    for (let i = 0; i < 12; i++) {
      const s = raw.slice(15 + i * w, 15 + (i + 1) * w).trim();
      const n = Number(s);
      vals.push(s === '' || Number.isNaN(n) || MISSING.has(n) || n <= -600 ? null : n);
    }
    out.push({ date, param, startHour: hf === 2 ? 13 : 1, vals });
  }
  return out;
}

/** ARCH/TITULOS → nombre e indicativo de la estación */
export function parseTitulos(txt) {
  const s = String(txt).split(/\r?\n|\r/)[0] || '';
  const m = s.match(/^(\d{3})(\d{5})\d?\s+(.+?)\s{2,}/);
  return m ? { code: m[1], index: m[2], name: m[3].trim() } : null;
}

/** Genera un archivo .SYN con el formato del programa anterior (registros de 102 caracteres + CR). */
export function buildSynFile(obsList, code) {
  code = String(code || '000').padStart(3, '0').slice(-3);
  const pad2 = (n) => String(n).padStart(2, '0');
  let out = '';
  for (const o of obsList) {
    if (!o || !o.synop) continue;
    const [l0, ...rest] = o.synop.trim().split('\n');
    const body = rest.join(' ').replace(/=\s*$/, '').trim();
    const yy = (l0.split(/\s+/)[1] || '');
    const key = `${code}${o.date.replace(/-/g, '')}${pad2(o.hour)}`;
    const i3 = body.indexOf(' 333 '); const i5 = body.indexOf(' 555 ');
    const s1 = body.slice(0, i3 >= 0 ? i3 : i5 >= 0 ? i5 : body.length).trim();
    const s3 = i3 >= 0 ? body.slice(i3 + 5, i5 >= 0 ? i5 : body.length).trim() : '';
    const s5 = i5 >= 0 ? body.slice(i5 + 5).trim() : '';
    const g3 = s3 ? s3.split(/\s+/) : [];
    const rec = (sec, txt) => (key + sec + ' ' + txt).padEnd(102).slice(0, 102) + '\r';
    out += rec('01111', `${yy} ${s1}`)
      + rec('03333', `333 ${g3.filter((g) => !g.startsWith('9')).join(' ')}`.trim())
      + rec('03336', g3.filter((g) => g.startsWith('9')).join(' '))
      + rec('05555', `555 ${s5}`.trim())
      + rec('05556', '');
  }
  return out;
}
