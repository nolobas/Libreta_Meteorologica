// Pruebas de los cálculos con valores conocidos del programa original (San Rafael Aero, 87509).
import assert from 'node:assert/strict';
import { psychro, seaLevelPressure, nationalReduction } from '../src/lib/meteo.js';
import { computeObs, encodeSynop, decodeSynop, defaultConfig } from '../src/lib/synop.js';

const near = (a, b, tol, msg) => assert.ok(Math.abs(a - b) <= tol, `${msg}: ${a} ≠ ${b}`);

const p = psychro(27.2, 16.0, 929.7);
near(p.e, 9.8, 0.05, 'tensión de vapor'); near(p.hr, 27, 0.5, 'humedad relativa'); near(p.td, 6.6, 0.15, 'punto de rocío');
near(seaLevelPressure(929.7, 27.2, 24.8, 748), 1011.8, 0.15, 'presión al nivel del mar');
near(nationalReduction(930.4, 748), 1017.3, 0.15, 'reducción 555');

// cielo despejado: h = 9
const cfg = defaultConfig(); cfg.station.index = '87509'; cfg.station.altitude = 748;
const o = { date: '2026-11-08', hour: 12, presReading: 936.6, dry: 17.0, td: 4.5, windDir: 'C', windSpeed: 0, N: 0, VV: 98, tmax: 17.2, tmin: 7.9, E: 0, tsup: 6, precipNone: true };
const syn = encodeSynop(o, computeObs(o, cfg, {}), cfg).text;
assert.match(syn, /87509 32998 00000 /, 'grupo iRixhVV');
assert.match(syn, / 30006/, 'grupo 3EsnTgTg');

// decodificar y volver a codificar un mensaje real
const msg = 'AAXX 15124\n87509 32970 53208 10132 21068 39304 40157 50009 80001 333 10172 20041 56000 85070 555 10173 41///=';
const d = decodeSynop(msg);
const back = encodeSynop({ date: '2010-01-15', hour: 12, ...d.o }, d.v, { ...cfg, system: { ...cfg.system } }).text;
assert.equal(back.replace(/\s+/g, ' '), msg.replace(/\s+/g, ' '));

console.log('Todas las pruebas pasaron.');
