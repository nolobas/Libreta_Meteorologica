// Tablas de claves meteorológicas (OMM / SMN) usadas por la Libreta.
// Los textos se tomaron de las pantallas del programa original (ARCH/*.TXT).
export { WW } from './ww.js';

// Tiempo pasado W1 W2 (tabla 4561)
export const W_PAST = [
  'Nubes cubriendo la mitad del cielo o menos durante todo el período',
  'Nubes cubriendo más de la mitad del cielo durante parte del período y la mitad o menos durante el resto',
  'Nubes cubriendo más de la mitad del cielo durante todo el período',
  'Tempestad de arena, de polvo o ventisca alta',
  'Niebla, niebla helada o bruma espesa',
  'Llovizna',
  'Lluvia',
  'Nieve, o lluvia con nieve',
  'Chaparrón',
  'Tormenta, con o sin precipitación',
];

// Rumbos: código de 16 rumbos -> dd (decenas de grados) usado en el SYNOP
export const RUMBOS = [
  { code: 'C', name: 'Calma', dd: 0 },
  { code: 'N', name: 'Norte', dd: 36 },
  { code: 'NNE', name: 'Nornoreste', dd: 2 },
  { code: 'NE', name: 'Noreste', dd: 5 },
  { code: 'ENE', name: 'Estenoreste', dd: 7 },
  { code: 'E', name: 'Este', dd: 9 },
  { code: 'ESE', name: 'Estesureste', dd: 11 },
  { code: 'SE', name: 'Sureste', dd: 14 },
  { code: 'SSE', name: 'Sursureste', dd: 16 },
  { code: 'S', name: 'Sur', dd: 18 },
  { code: 'SSW', name: 'Sursuroeste', dd: 20 },
  { code: 'SW', name: 'Suroeste', dd: 23 },
  { code: 'WSW', name: 'Oestesuroeste', dd: 25 },
  { code: 'W', name: 'Oeste', dd: 27 },
  { code: 'WNW', name: 'Oestenoroeste', dd: 29 },
  { code: 'NW', name: 'Noroeste', dd: 32 },
  { code: 'NNW', name: 'Nornoroeste', dd: 34 },
  { code: 'VRB', name: 'Variable', dd: 99 },
];
export function rumboFromDD(dd) {
  if (dd == null) return null;
  if (dd === 0) return 'C';
  if (dd === 99) return 'VRB';
  let best = null, bd = 1e9;
  for (const r of RUMBOS) {
    if (r.dd === 0 || r.dd === 99) continue;
    let d = Math.abs(r.dd - dd); d = Math.min(d, 36 - d);
    if (d < bd) { bd = d; best = r.code; }
  }
  return best;
}

export const N_OKTAS = [
  '0 — Cielo despejado', '1 octavo', '2 octavos', '3 octavos', '4 octavos',
  '5 octavos', '6 octavos', '7 octavos', '8 — Cielo cubierto', '9 — Cielo invisible (niebla u otro fenómeno)',
];

// Altura de la base de la nube más baja (h, tabla 1600)
export const H_BASE = [
  '0 a 50 m', '50 a 100 m', '100 a 200 m', '200 a 300 m', '300 a 600 m',
  '600 a 1000 m', '1000 a 1500 m', '1500 a 2000 m', '2000 a 2500 m', '2500 m o más, o sin nubes',
];

export const CL = [
  'Sin nubes bajas',
  'Cu humilis o Cu fractus de buen tiempo',
  'Cu mediocris o congestus, con o sin otros Cu/Sc a igual nivel',
  'Cb calvus, con o sin Cu, Sc o St',
  'Sc cumulogenitus',
  'Sc no cumulogenitus',
  'St nebulosus o St fractus (no de mal tiempo)',
  'St fractus o Cu fractus de mal tiempo',
  'Cu y Sc no cumulogenitus con bases a distintos niveles',
  'Cb capillatus (a menudo con yunque), con o sin otras nubes',
];
export const CM = [
  'Sin nubes medias',
  'As translucidus',
  'As opacus o Ns',
  'Ac translucidus en un solo nivel',
  'Bancos de Ac translucidus (a menudo lenticulares), cambiantes',
  'Ac en bandas o capas que invaden el cielo',
  'Ac cumulogenitus (o cumulonimbogenitus)',
  'Ac en dos o más capas, o con As o Ns',
  'Ac castellanus o floccus',
  'Ac de cielo caótico',
];
export const CH = [
  'Sin nubes altas',
  'Ci fibratus o uncinus, que no invaden el cielo',
  'Ci spissatus en bancos, o castellanus/floccus',
  'Ci spissatus cumulonimbogenitus',
  'Ci uncinus o fibratus que invaden el cielo',
  'Ci y Cs (o Cs solos) invadiendo, velo por debajo de 45°',
  'Ci y Cs (o Cs solos) invadiendo, velo por encima de 45°',
  'Cs que cubren todo el cielo',
  'Cs que no invaden ni cubren todo el cielo',
  'Cc solos o predominantes',
];
// Género de nube (C, tabla 0500) para grupos 8NsChshs y 57CDaeC
export const GENERO = [
  'Cirrus (Ci)', 'Cirrocumulus (Cc)', 'Cirrostratus (Cs)', 'Altocumulus (Ac)', 'Altostratus (As)',
  'Nimbostratus (Ns)', 'Stratocumulus (Sc)', 'Stratus (St)', 'Cumulus (Cu)', 'Cumulonimbus (Cb)',
];
// Dirección (tabla 0700) para grupo 56DLDMDH
export const DIR_0700 = [
  'Estacionario o sin nubes', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'Desconocida o nubes invisibles',
];
export const DIR_57 = ['En la estación', 'NE', 'E', 'SE', 'S', 'SW', 'W', 'NW', 'N', 'Todas las direcciones'];
export const ANG_ELEV = [
  'Cima no visible', '45° o más', '30° aprox.', '20° aprox.', '15° aprox.', '12° aprox.', '9° aprox.', '7° aprox.', '6° aprox.', 'Menor que 5°',
];

// Altura de capas hshs (tabla 1677)
export function hshsText(c) {
  c = Number(c);
  if (c === 0) return 'menos de 30 m';
  if (c >= 1 && c <= 50) return `${c * 30} m`;
  if (c >= 56 && c <= 80) return `${(c - 50) * 300} m`;
  if (c >= 81 && c <= 88) return `${10500 + (c - 81) * 1500} m`;
  if (c === 89) return 'más de 21000 m';
  const r = { 90: '< 50 m', 91: '50–100 m', 92: '100–200 m', 93: '200–300 m', 94: '300–600 m', 95: '600–1000 m', 96: '1000–1500 m', 97: '1500–2000 m', 98: '2000–2500 m', 99: '≥ 2500 m' };
  return r[c] || '—';
}
export function hshsToMeters(c) {
  c = Number(c);
  if (Number.isNaN(c)) return null;
  if (c <= 50) return c * 30;
  if (c >= 56 && c <= 80) return (c - 50) * 300;
  if (c >= 81 && c <= 89) return 10500 + (c - 81) * 1500;
  return null;
}
export function metersToHshs(m) {
  if (m == null || isNaN(m)) return null;
  if (m < 30) return 0;
  if (m <= 1500) return Math.min(50, Math.floor(m / 30));
  if (m <= 9000) return Math.min(80, 50 + Math.floor(m / 300));
  if (m <= 21000) return Math.min(88, 81 + Math.floor((m - 10500) / 1500));
  return 89;
}
export function metersToH(m) {
  if (m == null || isNaN(m)) return null;
  const lim = [50, 100, 200, 300, 600, 1000, 1500, 2000, 2500];
  for (let i = 0; i < lim.length; i++) if (m < lim[i]) return i;
  return 9;
}

// Visibilidad VV (tabla 4377)
export function vvText(c) {
  c = Number(c);
  if (isNaN(c)) return '—';
  if (c === 0) return 'menos de 100 m';
  if (c >= 1 && c <= 9) return `${c * 100} m`;
  if (c >= 10 && c <= 50) return `${(c / 10).toFixed(1).replace('.', ',')} km`;
  if (c >= 51 && c <= 55) return 'no se utiliza';
  if (c >= 56 && c <= 80) return `${c - 50} km`;
  if (c >= 81 && c <= 88) return `${30 + (c - 80) * 5} km`;
  if (c === 89) return 'más de 70 km';
  const g = ['< 50 m', '50 m', '200 m', '500 m', '1 km', '2 km', '4 km', '10 km', '20 km', '≥ 50 km'];
  if (c >= 90 && c <= 99) return g[c - 90];
  return '—';
}
export function vvToKm(c) {
  c = Number(c);
  if (isNaN(c)) return null;
  if (c <= 50) return c / 10;
  if (c >= 56 && c <= 80) return c - 50;
  if (c >= 81 && c <= 88) return 30 + (c - 80) * 5;
  if (c === 89) return 75;
  const g = [0.04, 0.05, 0.2, 0.5, 1, 2, 4, 10, 20, 50];
  if (c >= 90) return g[c - 90];
  return null;
}
export function kmToVV(km) {
  if (km == null || isNaN(km)) return null;
  if (km < 0.1) return 0;
  if (km <= 5) return Math.round(km * 10);
  if (km < 6) return 50;
  if (km <= 30) return 50 + Math.floor(km);
  if (km <= 70) return 80 + Math.floor((km - 30) / 5);
  return 89;
}

export const TENDENCIA = [
  'En alza, luego en baja; la presión es igual o más alta que 3 h antes',
  'En alza, luego estacionaria; o en alza, luego en alza más lenta',
  'En alza (regular o irregular)',
  'En baja o estacionaria, luego en alza; o en alza, luego en alza más rápida',
  'Estacionaria; la presión es la misma que 3 h antes',
  'En baja, luego en alza; la presión es igual o más baja que 3 h antes',
  'En baja, luego estacionaria; o en baja, luego en baja más lenta',
  'En baja (regular o irregular)',
  'Estacionaria o en alza, luego en baja; o en baja, luego en baja más rápida',
];

// Estado del suelo sin nieve (E, tabla 0901)
export const ESTADO_SUELO = [
  'Superficie del suelo seca',
  'Superficie del suelo húmeda',
  'Superficie del suelo mojada',
  'Superficie del suelo inundada',
  'Superficie del suelo helada',
  'Cencellada (hielo liso) transparente sobre el suelo',
  'Polvo/arena secos sueltos que no cubren el suelo',
  'Fina capa de polvo/arena secos sueltos que cubren el suelo',
  'Capa media/espesa de polvo/arena secos sueltos que cubren el suelo',
  'Suelo extremadamente seco y agrietado',
];
// Estado del suelo con nieve o hielo medible (E', tabla 0975)
export const ESTADO_SUELO_NIEVE = [
  'Suelo cubierto en forma predominante por hielo',
  'Nieve compacta o húmeda cubriendo menos de la mitad del suelo',
  'Nieve compacta o húmeda cubriendo al menos la mitad del suelo, sin cubrirlo totalmente',
  'Capa uniforme de nieve compacta o húmeda cubriendo totalmente el suelo',
  'Capa no uniforme de nieve compacta o húmeda cubriendo totalmente el suelo',
  'Nieve seca suelta cubriendo menos de la mitad del suelo',
  'Nieve seca suelta cubriendo al menos la mitad del suelo, sin cubrirlo totalmente',
  'Capa uniforme de nieve seca cubriendo totalmente el suelo',
  'Capa no uniforme de nieve seca cubriendo totalmente el suelo',
  'Nieve cubriendo totalmente el suelo, con amontonamientos importantes',
];

// Estado de la planta de evaporación (pantalla EVATIT)
export const EVAP_ESTADO = [
  { code: '0', text: 'Toda la planta de evaporación está en servicio' },
  { code: '1', text: 'Tanque A fuera de servicio' },
  { code: '2', text: 'Medidor atmométrico fuera de servicio' },
  { code: '3', text: 'Probeta del medidor atmométrico fuera de servicio' },
  { code: '4', text: 'Anemómetro totalizador fuera de servicio' },
  { code: '5', text: 'Pluviómetro fuera de servicio' },
  { code: '6', text: 'Termómetro con flotador fuera de servicio' },
  { code: '/', text: 'Tanque A congelado' },
];

// Fenómenos e hidrometeoros diarios (pantalla FENO2.TXT)
export const FENOMENOS = [
  'Lluvia', 'Nieve', 'Llovizna', 'Chaparrón de lluvia', 'Chaparrón de nieve', 'Chaparrón de lluvia y nieve', 'Granizo',
  'Granos de nieve', 'Niebla', 'Neblina', 'Niebla baja', 'Bruma', 'Tormenta eléctrica', 'Relámpagos', 'Viento fuerte',
  'Rocío', 'Helada', 'Escarcha', 'Hielo glaseado', 'Ventisca', 'Ventisca alta', 'Ventisca baja', 'Torbellino',
  'Tempestad de polvo', 'Agua nieve', 'Granos de hielo', 'Prismas de hielo', 'Cencellada blanda', 'Cencellada dura',
  'Gránulos de nieve', 'Humo',
];

export const MESES = ['Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio', 'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre'];

// Escala Beaufort: límites superiores en nudos
const BEAUFORT_KT = [0.9, 3.4, 6.4, 10.4, 16.4, 21.4, 27.4, 33.4, 40.4, 47.4, 55.4, 63.4, 999];
const BEAUFORT_MID_KT = [0, 2, 5, 9, 13, 19, 24, 30, 37, 44, 52, 60, 68];
export function toKnots(v, unit) {
  if (v == null || v === '' || isNaN(v)) return null;
  v = Number(v);
  switch (unit) {
    case 'kt': return v;
    case 'kmh': return v / 1.852;
    case 'ms': return v * 1.943844;
    case 'bf': return BEAUFORT_MID_KT[Math.max(0, Math.min(12, Math.round(v)))];
    default: return v;
  }
}
export function knotsToBeaufort(kt) {
  for (let i = 0; i < BEAUFORT_KT.length; i++) if (kt <= BEAUFORT_KT[i]) return i;
  return 12;
}
export const UNIDADES_VIENTO = [
  { code: 'kt', name: 'Nudos (kt)' },
  { code: 'kmh', name: 'Kilómetros por hora (km/h)' },
  { code: 'ms', name: 'Metros por segundo (m/s)' },
  { code: 'bf', name: 'Escala Beaufort' },
];
export const INSTR_VIENTO = [
  { code: '1', name: 'Anemómetro' },
  { code: '2', name: 'Anemógrafo' },
  { code: '3', name: 'Anemoveleta' },
  { code: '4', name: 'Escala Beaufort (estimado)' },
];
