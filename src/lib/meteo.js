// Cálculos meteorológicos de la Libreta.
// Fórmulas verificadas contra los datos históricos del programa original.

export const G = 9.80665;   // gravedad normal (m/s²)
export const RD = 287.05;   // constante de los gases para aire seco (J/kg K)
export const MMHG_TO_HPA = 1.333224;

export const isNum = (x) => x !== null && x !== undefined && x !== '' && !Number.isNaN(Number(x));
export const num = (x) => (isNum(x) ? Number(x) : null);
export const r1 = (x) => (x == null ? null : Math.round(x * 10) / 10);

// Tensión de saturación (hPa), Magnus–OMM
export function esWater(t) { return 6.112 * Math.exp((17.62 * t) / (243.12 + t)); }
export function esIce(t) { return 6.112 * Math.exp((22.46 * t) / (272.62 + t)); }

export function dewPointFromE(e) {
  if (!(e > 0)) return null;
  const l = Math.log(e / 6.112);
  return (243.12 * l) / (17.62 - l);
}

/**
 * Cálculo psicrométrico (psicrómetro no ventilado, garita de abrigo).
 * A = 0,0008 /°C sobre agua; 0,00072 /°C con el bulbo húmedo congelado.
 * Devuelve tensión de vapor e (hPa), humedad relativa (%), punto de rocío (°C).
 */
export function psychro(t, tw, p = 1000, iced = false) {
  if (!isNum(t) || !isNum(tw)) return null;
  t = Number(t); tw = Number(tw);
  const ice = iced || tw < 0;
  const ew = ice ? esIce(tw) : esWater(tw);
  const A = ice ? 0.00072 : 0.0008;
  let e = ew - A * (p || 1000) * (t - tw);
  if (e < 0.05) e = 0.05;
  const hr = Math.max(1, Math.min(100, (100 * e) / esWater(t)));
  return { e, hr, td: dewPointFromE(e) };
}

export function rhFromTTd(t, td) {
  if (!isNum(t) || !isNum(td)) return null;
  return Math.max(1, Math.min(100, (100 * esWater(td)) / esWater(t)));
}

/**
 * Presión a nivel de la estación (hPa) a partir de la lectura del barómetro.
 * tipo: '1' Fortin, '2' Kew (mmHg, corrección por temperatura y gravedad), '3' digital (hPa).
 */
export function stationPressure({ reading, tAtt, tipo = '3', corrInstr = 0, corrGrav = 0 }) {
  if (!isNum(reading)) return null;
  let b = Number(reading);
  if (String(tipo) === '3') return b + (Number(corrInstr) || 0);
  // mercurio: reducción a 0 °C (escala de latón)
  if (isNum(tAtt)) {
    const t = Number(tAtt);
    b = b - (b * (0.0001818 - 0.0000184) * t) / (1 + 0.0001818 * t);
  }
  b += (Number(corrInstr) || 0) + (Number(corrGrav) || 0);
  return b * MMHG_TO_HPA;
}

/**
 * Presión reducida al nivel medio del mar (fórmula hipsométrica OMM).
 * Usa la temperatura media entre la hora de observación y 12 h antes.
 */
export function seaLevelPressure(pst, t, t12, h) {
  if (!isNum(pst) || !isNum(h)) return null;
  const tt = isNum(t) ? Number(t) : 15;
  const t2 = isNum(t12) ? Number(t12) : tt;
  const tm = (tt + t2) / 2 + 273.15 + (0.0065 * h) / 2;
  return pst * Math.exp((G * h) / (RD * tm));
}

/** Reducción "nacional" (grupo 555 1PPPP): temperatura media de columna fija. */
export function nationalReduction(pst, h, tFix = 12.7) {
  if (!isNum(pst) || !isNum(h)) return null;
  return pst * Math.exp((G * h) / (RD * (Number(tFix) + 273.15)));
}

// Tabla de sensación térmica por calor del SMN (ARCH/TABLA.SEN): T 20..50 °C × HR 0..100 %
const HEAT = [
  [16,16,17,17,17,18,18,19,19,19,19,19,20,20,20,21,21,21,21,21,21],
  [18,18,18,19,19,19,19,19,20,20,20,20,21,21,21,22,22,22,22,22,23],
  [19,19,19,20,20,20,20,20,21,21,21,21,22,22,22,22,23,23,23,23,24],
  [20,20,20,20,21,21,22,22,22,23,23,23,23,24,24,24,24,24,24,25,25],
  [21,21,22,22,22,22,23,23,23,24,24,24,24,25,25,25,25,26,26,26,26],
  [22,23,23,23,24,24,24,24,24,24,25,25,25,26,26,26,27,27,28,28,28],
  [24,24,24,24,25,25,25,26,26,26,26,27,27,27,27,28,28,29,29,29,30],
  [25,25,25,25,26,26,26,27,27,27,27,28,28,29,29,30,30,31,31,31,33],
  [26,26,26,26,27,27,27,28,28,28,29,29,29,30,31,32,32,33,34,34,36],
  [26,26,27,27,27,28,29,29,29,29,30,30,31,33,33,34,35,35,37,38,40],
  [27,27,28,28,28,28,29,29,30,30,31,32,33,34,35,36,37,39,40,41,45],
  [28,28,29,29,29,29,30,31,31,31,33,34,35,36,37,39,40,41,45,45,50],
  [29,29,29,29,30,31,31,33,33,34,35,35,37,39,40,42,44,45,51,51,55],
  [29,29,30,30,31,33,33,34,34,35,36,38,39,42,43,45,49,49,53,54,55],
  [30,30,31,31,32,34,34,35,36,37,38,41,42,44,47,48,50,52,55,55,55],
  [31,32,32,32,33,35,35,37,37,40,40,44,45,47,51,52,55,55,55,55,55],
  [32,33,33,34,35,36,37,39,39,42,43,46,49,50,54,55,55,55,55,55,55],
  [32,33,34,35,36,38,38,41,41,44,46,49,51,55,55,55,55,55,55,55,55],
  [33,34,35,36,37,39,40,43,44,47,49,51,55,55,55,55,55,55,55,55,55],
  [34,35,36,37,38,41,41,44,46,50,50,55,55,55,55,55,55,55,55,55,55],
  [35,36,37,39,40,43,43,47,49,53,55,55,55,55,55,55,55,55,55,55,55],
  [35,36,38,40,41,44,45,49,50,55,55,55,55,55,55,55,55,55,55,55,55],
  [36,37,39,41,42,45,47,50,52,55,55,55,55,55,55,55,55,55,55,55,55],
  [37,38,40,42,44,47,49,53,55,55,55,55,55,55,55,55,55,55,55,55,55],
  [38,39,41,44,45,49,52,55,55,55,55,55,55,55,55,55,55,55,55,55,55],
  [38,40,42,45,47,50,54,55,55,55,55,55,55,55,55,55,55,55,55,55,55],
  [39,41,43,45,49,51,55,55,55,55,55,55,55,55,55,55,55,55,55,55,55],
  [40,42,44,47,51,54,55,55,55,55,55,55,55,55,55,55,55,55,55,55,55],
  [41,43,45,49,53,55,55,55,55,55,55,55,55,55,55,55,55,55,55,55,55],
  [42,45,47,50,54,55,55,55,55,55,55,55,55,55,55,55,55,55,55,55,55],
  [42,45,48,50,55,55,55,55,55,55,55,55,55,55,55,55,55,55,55,55,55],
];

/** Sensación térmica (°C): por frío (índice de enfriamiento por viento) o por calor (tabla SMN). */
export function sensacionTermica(t, hr, vientoKmh) {
  if (!isNum(t)) return null;
  t = Number(t);
  const v = isNum(vientoKmh) ? Number(vientoKmh) : 0;
  if (t <= 10 && v > 4.8) {
    const p = Math.pow(v, 0.16);
    return Math.min(t, 13.12 + 0.6215 * t - 11.37 * p + 0.3965 * t * p);
  }
  if (t >= 20 && isNum(hr)) {
    const ti = Math.min(50, Math.round(t)) - 20;
    const hi = Math.max(0, Math.min(20, Math.round(Number(hr) / 5)));
    return Math.max(t, HEAT[ti][hi]);
  }
  return t;
}

/** Duración astronómica del día (horas) — heliofanía teórica. */
export function dayLength(latDeg, date) {
  const d = date instanceof Date ? date : new Date(date + 'T12:00:00Z');
  const start = Date.UTC(d.getUTCFullYear(), 0, 0);
  const n = Math.floor((d.getTime() - start) / 86400000);
  const g = (2 * Math.PI / 365) * (n - 1);
  const decl = 0.006918 - 0.399912 * Math.cos(g) + 0.070257 * Math.sin(g) - 0.006758 * Math.cos(2 * g)
    + 0.000907 * Math.sin(2 * g) - 0.002697 * Math.cos(3 * g) + 0.00148 * Math.sin(3 * g);
  const phi = (latDeg * Math.PI) / 180;
  const h0 = (-0.833 * Math.PI) / 180;
  let c = (Math.sin(h0) - Math.sin(phi) * Math.sin(decl)) / (Math.cos(phi) * Math.cos(decl));
  c = Math.max(-1, Math.min(1, c));
  return (2 * Math.acos(c) * 180) / Math.PI / 15;
}

export const fmt = (x, d = 1) => (x == null || Number.isNaN(x) ? '' : Number(x).toFixed(d));
export const fmtC = (x, d = 1) => (x == null || Number.isNaN(x) ? '—' : Number(x).toFixed(d).replace('.', ','));
