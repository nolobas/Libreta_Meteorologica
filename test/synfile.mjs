import fs from 'fs';
import { parseSynFile, buildSynFile } from '../src/lib/legacy.js';
const f = '/home/claude/src/LIBRETA/DAT/SYN/32502203.SYN';
const recs = parseSynFile(fs.readFileSync(f, 'latin1'));
const out = buildSynFile(recs.map((r) => ({ date: r.date, hour: r.hour, synop: r.text })), '325');
const back = parseSynFile(out);
let same = 0; recs.forEach((r, i) => { if (back[i] && back[i].text.replace(/\s+/g,' ') === r.text.replace(/\s+/g,' ')) same++; });
console.log('registros', recs.length, 'idénticos tras regenerar .SYN', same);
const orig = fs.readFileSync(f,'latin1').split('\r')[0]; console.log(JSON.stringify(orig)); console.log(JSON.stringify(out.split('\r')[0]));
