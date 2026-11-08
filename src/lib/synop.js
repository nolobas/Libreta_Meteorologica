// Cálculo de una observación y codificación / decodificación del mensaje SYNOP (FM 12).
import { RUMBOS, toKnots, metersToH } from './tables.js';
import {
  isNum, num, psychro, rhFromTTd, stationPressure, seaLevelPressure, nationalReduction,
  sensacionTermica, esWater,
} from './meteo.js';

const pad = (n, w) => String(Math.round(Math.abs(n))).padStart(w, '0').slice(-w);
const sn = (t) => (t < 0 ? '1' : '0');
const tGroup = (t) => (isNum(t) ? sn(t) + pad(Math.round(Math.abs(t) * 10), 3) : '////');
const pGroup = (p) => (isNum(p) ? pad(Math.round(p * 10) % 10000, 4) : '////');
const d1 = (x) => (x === null || x === undefined || x === '' ? '/' : String(x).slice(-1));
const d2 = (x) => (isNum(x) ? pad(x, 2) : '//');

export function defaultConfig() {
  return {
    station: {
      code: '', name: 'Estación meteorológica', index: '', latDeg: 34, latMin: 0, lonDeg: 64, lonMin: 0,
      altitude: 0, tabla: '', presMedia: '', tensMedia: '', corrGrav: 0, tReduc: 12.7,
      bulletin: 'SMMR41', center: 'SAMR', aftn: 'MRSAMR', huso: -3,
    },
    corrections: { seco: 0, humedo: 0, max: 0, min: 0, sup: 0, sup05: 0, baroTipo: '3', baroCorr: 0, fecha: '' },
    limits: {
      max: { seco: 45, humedo: 32, presion: 1060, tmax: 47, tmin: 32, viento: 80 },
      min: { seco: -20, humedo: -20, presion: 850, tmax: -10, tmin: -25, humedad: 1 },
      fecha: '',
    },
    system: {
      pistaAlt: '', freatimetro: false, evaporacion: true, heliofanografo: true, barografoUnidad: '2',
      mainHours: [0, 12], precipHours: [0, 6, 12, 18], windUnit: 'kt', windInstr: '1',
      password: '', iw: '4', ventilado: false,
    },
  };
}

export function obsKey(date, hour) { return `${date}T${String(hour).padStart(2, '0')}`; }

/** Calcula todos los valores derivados de una observación. */
export function computeObs(o, cfg, ctx = {}) {
  const c = cfg.corrections || {};
  const st = cfg.station || {};
  const sys = cfg.system || {};
  const v = { ...(o.v || {}) };
  const hasRaw = isNum(o.dry) || isNum(o.presReading) || isNum(o.windSpeed) || o.windDir;
  if (o.imported && !hasRaw) return v; // datos importados: valores ya resueltos

  const add = (x, k) => (isNum(x) ? Number(x) + (Number(c[k]) || 0) : null);
  v.T = add(o.dry, 'seco');
  v.Tw = add(o.wet, 'humedo');
  v.Tmax = add(o.tmax, 'max');
  v.Tmin = add(o.tmin, 'min');
  v.Tsup = add(o.tsup, 'sup');
  v.T05 = add(o.t05, 'sup05');
  v.Tg = isNum(o.tgmin) ? Number(o.tgmin) + (Number(c.sup) || 0) : v.Tsup;

  v.Pst = stationPressure({
    reading: o.presReading, tAtt: o.tAtt, tipo: c.baroTipo || '3',
    corrInstr: c.baroCorr, corrGrav: st.corrGrav,
  });
  const h = num(st.altitude);
  v.T12 = isNum(ctx.t12) ? Number(ctx.t12) : null;
  v.Pmsl = v.Pst != null && h != null ? seaLevelPressure(v.Pst, v.T, v.T12, h) : null;
  v.Pnac = v.Pst != null && h != null ? nationalReduction(v.Pst, h, st.tReduc ?? 12.7) : null;

  const ps = psychro(v.T, v.Tw, v.Pst || 1000, !!o.iced);
  if (ps) { v.e = ps.e; v.HR = ps.hr; v.Td = ps.td; } else if (isNum(o.td)) {
    v.Td = Number(o.td); v.HR = rhFromTTd(v.T, v.Td); v.e = esWater(v.Td);
  } else { v.e = v.HR = v.Td = null; }

  // tendencia
  if (v.Pst != null && isNum(ctx.p3)) {
    v.dP3 = v.Pst - Number(ctx.p3);
    v.ppp = Math.round(Math.abs(v.dP3) * 10);
  } else { v.dP3 = null; v.ppp = null; }
  v.a = isNum(o.tendA) ? Number(o.tendA) : (v.dP3 == null ? null : (Math.abs(v.dP3) < 0.05 ? 4 : v.dP3 > 0 ? 2 : 7));

  // viento
  const unit = o.windUnit || sys.windUnit || 'kt';
  const r = RUMBOS.find((x) => x.code === o.windDir);
  v.dd = r ? r.dd : (isNum(o.windDD) ? Number(o.windDD) : null);
  const kt = toKnots(o.windSpeed, unit);
  v.ff = r && r.dd === 0 ? 0 : (kt == null ? null : Math.round(kt));
  if (v.dd === 0) v.ff = 0;
  v.ffKmh = v.ff == null ? null : v.ff * 1.852;
  const g = toKnots(o.gustSpeed, unit);
  v.gust = g == null ? null : Math.round(g);
  v.gustDir = o.gustDir || null;

  v.ST = sensacionTermica(v.T, v.HR, v.ffKmh);

  // nubes / tiempo / visibilidad
  for (const k of ['N', 'Nh', 'CL', 'CM', 'CH', 'ww', 'W1', 'W2', 'VV', 'E', 'Eprime']) v[k] = isNum(o[k]) ? Number(o[k]) : null;
  v.h = isNum(o.hCode) ? Number(o.hCode) : (isNum(o.hBase) ? metersToH(Number(o.hBase)) : null);
  // sin nubes (N=0) o sin nubes bajas ni medias: la base se informa como 9 (2500 m o más / sin nubes)
  if (v.h == null && (v.N === 0 || (v.CL === 0 && v.CM === 0))) v.h = 9;

  // precipitación de esta medición y acumulada para el SYNOP
  v.prMm = o.precipNone ? 0 : (o.precipTrace ? 0 : num(o.precipMm));
  v.prTrace = !!o.precipTrace && !o.precipNone;
  const hour = Number(o.hour);
  const precipHours = sys.precipHours || [0, 6, 12, 18];
  if (precipHours.includes(hour) && (v.prMm != null || v.prTrace || o.precipNone)) {
    let tot = v.prMm || 0; let trace = v.prTrace;
    if (hour === 12 && Array.isArray(ctx.precipPrev)) {
      for (const p of ctx.precipPrev) { tot += p.mm || 0; trace = trace || p.trace; }
    }
    v.RRR = tot; v.RRRtrace = tot === 0 && trace; v.tR = hour === 12 ? 4 : 1;
    if (hour === 12) { v.RRR6 = v.prMm || 0; v.RRR6trace = !(v.prMm > 0) && v.prTrace; }
  } else { v.RRR = null; v.RRRtrace = false; v.tR = null; v.RRR6 = null; v.RRR6trace = false; }
  return v;
}

// orden reglamentario de los grupos: por la cifra indicadora (orden estable)
function sortByLead(arr) {
  const idx = arr.map((g, i) => [g, i]);
  idx.sort((a, b) => (/\d/.test(a[0][0]) && /\d/.test(b[0][0]) ? Number(a[0][0]) - Number(b[0][0]) : 0) || a[1] - b[1]);
  arr.splice(0, arr.length, ...idx.map((x) => x[0]));
}

function rrrCode(mm, trace) {
  if (trace && !(mm > 0)) return '990';
  if (mm > 0 && mm < 1) return String(990 + Math.round(mm * 10)).slice(-3);
  return pad(Math.min(988, Math.round(mm)), 3);
}

/** Codifica el SYNOP. Devuelve { text, line0, groups } */
export function encodeSynop(o, v, cfg) {
  const st = cfg.station || {}; const sys = cfg.system || {};
  const day = Number(o.date.slice(8, 10)); const hour = Number(o.hour);
  const line0 = `AAXX ${pad(day, 2)}${pad(hour, 2)}${sys.iw || '4'}`;
  const s1 = [String(st.index || '').padStart(5, '0').slice(-5)];

  // iR
  let iR = '4';
  const s3precip = hour === 12 && v.RRR6 != null && (v.RRR > 0 || v.RRRtrace);
  if (v.RRR != null) iR = v.RRR > 0 || v.RRRtrace ? (s3precip ? '0' : '1') : '3';
  const sig = (v.ww != null && v.ww >= 4) || (v.W1 != null && v.W1 >= 3) || (v.W2 != null && v.W2 >= 3);
  const ix = sig ? '1' : '2';
  s1.push(iR + ix + d1(v.h) + d2(v.VV));
  // Nddff
  let ff = v.ff; let big = null;
  if (ff != null && ff >= 99) { big = ff; ff = 99; }
  s1.push(d1(v.N) + d2(v.dd) + d2(ff));
  if (big != null) s1.push('00' + pad(big, 3));
  if (isNum(v.T)) s1.push('1' + tGroup(v.T));
  if (isNum(v.Td)) s1.push('2' + tGroup(v.Td));
  if (isNum(v.Pst)) s1.push('3' + pGroup(v.Pst));
  if (isNum(v.Pmsl)) s1.push('4' + pGroup(v.Pmsl));
  if (v.ppp != null && v.a != null) s1.push('5' + v.a + pad(Math.min(999, v.ppp), 3));
  if (iR === '1' || iR === '0') s1.push('6' + rrrCode(v.RRR, v.RRRtrace) + v.tR);
  if (ix === '1') s1.push('7' + d2(v.ww ?? 0) + d1(v.W1 ?? '/') + d1(v.W2 ?? '/'));
  if (v.N != null && v.N > 0) {
    if (v.N === 9) { if ([v.Nh, v.CL, v.CM, v.CH].some((x) => x != null)) s1.push('8' + d1(v.Nh) + d1(v.CL) + d1(v.CM) + d1(v.CH)); }
    else s1.push('8' + d1(v.Nh) + d1(v.CL) + d1(v.CM) + d1(v.CH));
  }

  // Sección 3
  const s3 = [];
  const main = (sys.mainHours || [0, 12]).includes(hour);
  if (main) {
    if (isNum(v.Tmax)) s3.push('1' + tGroup(v.Tmax));
    if (isNum(v.Tmin)) s3.push('2' + tGroup(v.Tmin));
  }
  if (hour === 12) {
    if (v.Eprime != null) {
      s3.push('3/' + (isNum(v.Tg) ? sn(v.Tg) + pad(Math.round(Math.abs(v.Tg)), 2) : '///'));
      const s = isNum(o.snowCm) ? (Number(o.snowCm) > 996 ? '999' : pad(o.snowCm, 3)) : (o.snowCode || '///');
      s3.push('4' + v.Eprime + s);
    } else if (v.E != null || isNum(v.Tg)) {
      s3.push('3' + d1(v.E) + (isNum(v.Tg) ? sn(v.Tg) + pad(Math.round(Math.abs(v.Tg)), 2) : '///'));
    }
  }
  if ([o.DL, o.DM, o.DH].some((x) => isNum(x))) s3.push('56' + d1(o.DL) + d1(o.DM) + d1(o.DH));
  if ([o.c57C, o.c57Da, o.c57ec].some((x) => isNum(x))) s3.push('57' + d1(o.c57C) + d1(o.c57Da) + d1(o.c57ec));
  if (s3precip) s3.push('6' + rrrCode(v.RRR6, v.RRR6trace) + '1');
  for (const L of o.layers || []) {
    if (!isNum(L.Ns) && !isNum(L.C) && !isNum(L.hshs)) continue;
    s3.push('8' + d1(L.Ns) + d1(L.C) + d2(L.hshs));
  }
  const extra3 = String(o.extra333 || '').trim().toUpperCase();
  if (extra3) s3.push(...extra3.split(/\s+/));
  sortByLead(s3);

  // Sección 5 (grupos nacionales)
  const s5 = [];
  if (isNum(v.Pnac)) s5.push('1' + pGroup(v.Pnac));
  if (hour === 12 && (sys.evaporacion ?? true) && (isNum(o.evap) || o.evapEstado)) {
    const est = o.evapEstado || '0';
    s5.push('4' + est + (isNum(o.evap) ? pad(o.evap, 3) : '///'));
  }
  const extra5 = String(o.extra555 || '').trim().toUpperCase();
  if (extra5) s5.push(...extra5.split(/\s+/));
  sortByLead(s5);

  let body = s1.join(' ');
  if (s3.length) body += ' 333 ' + s3.join(' ');
  if (s5.length) body += ' 555 ' + s5.join(' ');
  body += '=';
  return { text: `${line0}\n${body}`, line0, groups: { s1, s3, s5 } };
}

/** Encabezado del boletín: SMMR41 SAMR DDHH00 */
export function bulletinHeader(cfg, date, hour) {
  const st = cfg.station || {};
  return `${st.bulletin || 'SMMR41'} ${st.center || 'SAMR'} ${date.slice(8, 10)}${pad(hour, 2)}00`;
}

// ---------------------------------------------------------------------------
// Decodificación (para importar los archivos .SYN del programa original)
const tVal = (g) => (/^[01]\d{3}$/.test(g) ? (g[0] === '1' ? -1 : 1) * Number(g.slice(1)) / 10 : null);
const pVal = (s) => (/^\d{4}$/.test(s) ? Number(s) / 10 + (Number(s) < 5000 ? 1000 : 0) : null);
const dig = (ch) => (/\d/.test(ch) ? Number(ch) : null);

export function decodeSynop(text) {
  const toks = String(text).replace(/=/g, ' ').trim().split(/\s+/).filter(Boolean);
  const out = { v: {}, o: {} };
  let i = 0;
  if (toks[i] === 'AAXX') { i++; const yg = toks[i++] || ''; out.day = Number(yg.slice(0, 2)); out.hour = Number(yg.slice(2, 4)); out.iw = yg[4]; }
  const v = out.v; const o = out.o;
  out.index = toks[i++];
  const irx = toks[i++] || '';
  out.iR = irx[0]; out.ix = irx[1]; v.h = dig(irx[2]); v.VV = /^\d\d$/.test(irx.slice(3, 5)) ? Number(irx.slice(3, 5)) : null;
  const nd = toks[i++] || '';
  v.N = dig(nd[0]); v.dd = /^\d\d$/.test(nd.slice(1, 3)) ? Number(nd.slice(1, 3)) : null;
  v.ff = /^\d\d$/.test(nd.slice(3, 5)) ? Number(nd.slice(3, 5)) : null;
  let sec = 1; const s3 = []; const s5 = [];
  for (; i < toks.length; i++) {
    const g = toks[i];
    if (g === '333') { sec = 3; continue; }
    if (g === '555') { sec = 5; continue; }
    if (sec === 1) {
      if (/^00\d{3}$/.test(g) && v.ff === 99) { v.ff = Number(g.slice(2)); continue; }
      switch (g[0]) {
        case '1': v.T = tVal(g.slice(1)); break;
        case '2': v.Td = tVal(g.slice(1)); break;
        case '3': v.Pst = pVal(g.slice(1)); break;
        case '4': v.Pmsl = pVal(g.slice(1)); break;
        case '5': v.a = dig(g[1]); v.ppp = /^\d{3}$/.test(g.slice(2)) ? Number(g.slice(2)) : null; break;
        case '6': {
          const r = g.slice(1, 4); v.tR = dig(g[4]);
          if (r === '990') { v.RRR = 0; v.RRRtrace = true; } else if (/^99[1-9]$/.test(r)) v.RRR = (Number(r) - 990) / 10;
          else if (/^\d{3}$/.test(r)) v.RRR = Number(r);
          break;
        }
        case '7': v.ww = /^\d\d$/.test(g.slice(1, 3)) ? Number(g.slice(1, 3)) : null; v.W1 = dig(g[3]); v.W2 = dig(g[4]); break;
        case '8': v.Nh = dig(g[1]); v.CL = dig(g[2]); v.CM = dig(g[3]); v.CH = dig(g[4]); break;
        default: break;
      }
    } else if (sec === 3) {
      if (g[0] === '1' && v.Tmax === undefined) v.Tmax = tVal(g.slice(1));
      else if (g[0] === '2' && v.Tmin === undefined) v.Tmin = tVal(g.slice(1));
      else if (g[0] === '3' && /^3[\d/][01/][\d/]{2}$/.test(g)) { v.E = dig(g[1]); v.Tg = /^\d\d$/.test(g.slice(3)) ? (g[2] === '1' ? -1 : 1) * Number(g.slice(3)) : null; }
      else if (g[0] === '4' && v.Eprime === undefined && /^4\d/.test(g)) { v.Eprime = dig(g[1]); o.snowCode = g.slice(2); }
      else if (g.startsWith('56')) { o.DL = dig(g[2]); o.DM = dig(g[3]); o.DH = dig(g[4]); }
      else if (g[0] === '6' && v.RRR6 === undefined && /^6[\d]{3}1$/.test(g)) {
        const r = g.slice(1, 4);
        if (r === '990') { v.RRR6 = 0; v.RRR6trace = true; } else if (/^99[1-9]$/.test(r)) v.RRR6 = (Number(r) - 990) / 10; else v.RRR6 = Number(r);
      }
      else if (g.startsWith('57')) { o.c57C = dig(g[2]); o.c57Da = dig(g[3]); o.c57ec = dig(g[4]); }
      else if (g[0] === '8') { (o.layers ||= []).push({ Ns: dig(g[1]), C: dig(g[2]), hshs: /^\d\d$/.test(g.slice(3)) ? Number(g.slice(3)) : null }); }
      else s3.push(g);
    } else {
      if (g[0] === '1' && v.Pnac === undefined) v.Pnac = pVal(g.slice(1));
      else if (g[0] === '4' && o.evapEstado === undefined && /^4[\d/]/.test(g)) { o.evapEstado = g[1]; o.evap = /^\d{3}$/.test(g.slice(2)) ? Number(g.slice(2)) : null; }
      else s5.push(g);
    }
  }
  if (s3.length) o.extra333 = s3.join(' ');
  if (s5.length) o.extra555 = s5.join(' ');
  if (out.iR === '3') { v.RRR = 0; v.RRRtrace = false; }
  if (v.T != null && v.Td != null) v.HR = rhFromTTd(v.T, v.Td);
  if (v.ff != null) v.ffKmh = v.ff * 1.852;
  if (v.T != null) v.ST = sensacionTermica(v.T, v.HR, v.ffKmh);
  for (const k of Object.keys(v)) if (v[k] === undefined) v[k] = null;
  return out;
}

/** Validaciones de coherencia (equivalentes a los controles del programa original). */
export function validateObs(o, v, cfg) {
  const L = cfg.limits || {}; const mx = L.max || {}; const mn = L.min || {};
  const errs = []; const warns = [];
  const chk = (val, lo, hi, label) => {
    if (val == null) return;
    if (isNum(hi) && val > Number(hi)) warns.push(`${label} (${val.toFixed(1)}) supera el límite máximo de la estación (${hi}).`);
    if (isNum(lo) && val < Number(lo)) warns.push(`${label} (${val.toFixed(1)}) es inferior al límite mínimo de la estación (${lo}).`);
  };
  chk(v.T, mn.seco, mx.seco, 'Termómetro seco');
  chk(v.Tw, mn.humedo, mx.humedo, 'Termómetro húmedo');
  chk(v.Pst, mn.presion, mx.presion, 'Presión en la estación');
  chk(v.Tmax, mn.tmax, mx.tmax, 'Temperatura máxima');
  chk(v.Tmin, mn.tmin, mx.tmin, 'Temperatura mínima');
  if (v.ff != null && isNum(mx.viento) && v.ff > Number(mx.viento)) warns.push(`Viento (${v.ff} kt) supera el límite máximo (${mx.viento} kt).`);
  if (v.HR != null && isNum(mn.humedad) && v.HR < Number(mn.humedad)) warns.push('Humedad relativa por debajo del límite mínimo.');

  if (v.T != null && v.Tw != null && v.Tw > v.T + 0.05) errs.push('El termómetro húmedo es mayor que el termómetro seco.');
  if (v.Tmax != null && v.Tmin != null && v.Tmin > v.Tmax) errs.push('La mínima corregida es mayor que la máxima.');
  if (v.Tmax != null && v.T != null && v.Tmax < v.T - 0.5) warns.push('La máxima es menor que la temperatura actual del termómetro seco.');
  if (v.Tmin != null && v.T != null && v.Tmin > v.T + 0.5) warns.push('La mínima es mayor que la temperatura actual del termómetro seco.');
  if (v.N != null) {
    for (const [k, lab] of [['Nh', 'nubes bajas/medias (Nh)']]) if (v[k] != null && v.N !== 9 && v[k] > v.N) errs.push(`El total de nubes es menor que ${lab}.`);
    if (v.N === 0 && ((v.CL ?? 0) > 0 || (v.CM ?? 0) > 0 || (v.CH ?? 0) > 0)) errs.push('Cielo despejado pero se informaron tipos de nubes.');
    if (v.N === 0 && v.ww != null && ((v.ww >= 50 && v.ww <= 99) || [13, 17, 18].includes(v.ww))) errs.push('El tiempo presente indica precipitación o fenómenos que requieren nubes, pero el total de nubes es 0.');
    if (v.N === 9 && v.VV != null && v.VV >= 10 && v.VV < 90) warns.push('Cielo invisible con visibilidad de 1 km o más: verifique.');
  }
  if (v.ww != null && v.T != null) {
    const nieve = (v.ww >= 70 && v.ww <= 79) || [56, 57, 66, 67, 85, 86].includes(v.ww) || v.ww === 48 || v.ww === 49;
    if (nieve && v.T >= 5) warns.push('Temperatura ≥ 5 °C y el tiempo presente indica nieve, niebla helada o precipitación engelante. Confirme.');
  }
  if (v.ww != null && v.ff != null) {
    if ([7, 8, 9, 30, 31, 32, 33, 34, 35, 36, 37, 38, 39, 98].includes(v.ww) && v.ff <= 10) warns.push('Viento débil y el tiempo presente indica fenómenos asociados a viento fuerte.');
  }
  if (v.ww != null && v.VV != null) {
    if (v.ww >= 41 && v.ww <= 49 && v.VV >= 10 && v.VV < 90) warns.push('El tiempo presente indica niebla: la visibilidad debería ser inferior a 1 km.');
  }
  if (v.gust != null && v.ff != null && v.gust < v.ff) errs.push('La ráfaga es menor que el viento de la observación.');
  if (v.Td != null && v.T != null && v.Td > v.T + 0.05) errs.push('El punto de rocío es mayor que la temperatura.');

  // datos faltantes que dejan barras (/) en el mensaje
  const hour = Number(o.hour); const sys = cfg.system || {};
  const falta = [];
  if (v.h == null) falta.push('altura de la base de la nube más baja (h)');
  if (v.VV == null) falta.push('visibilidad (VV)');
  if (v.N == null) falta.push('total de nubes (N)');
  if (v.dd == null || v.ff == null) falta.push('dirección y velocidad del viento');
  if (v.N != null && v.N > 0 && v.N < 9) {
    if (v.Nh == null) falta.push('cantidad de nubes bajas o medias (Nh)');
    if (v.CL == null || v.CM == null || v.CH == null) falta.push('tipos de nubes (CL, CM, CH)');
  }
  const sig = (v.ww != null && v.ww >= 4) || (v.W1 != null && v.W1 >= 3) || (v.W2 != null && v.W2 >= 3);
  if (sig && (v.W1 == null || v.W2 == null)) falta.push('tiempo pasado (W1 y W2)');
  if ((sys.precipHours || [0, 6, 12, 18]).includes(hour) && v.RRR == null) falta.push('precipitación (elija No hubo, Inapreciable o Medida)');
  if (hour === 12 && v.Eprime == null) {
    if (v.E == null) falta.push('estado del suelo (E)');
    if (v.Tg == null) falta.push('termómetro de superficie (mínima) para el grupo 3EsnTgTg');
  }
  if ((sys.mainHours || [0, 12]).includes(hour)) {
    if (v.Tmax == null) falta.push('temperatura máxima'); if (v.Tmin == null) falta.push('temperatura mínima');
  }
  if (falta.length) warns.unshift('Faltan datos (quedarían barras o grupos sin informar): ' + falta.join('; ') + '.');
  return { errs, warns };
}
