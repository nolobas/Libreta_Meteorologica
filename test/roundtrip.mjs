import fs from 'fs';
import { parseSynFile, synRecordToObs } from '../src/lib/legacy.js';
import { encodeSynop, defaultConfig } from '../src/lib/synop.js';
const dir = process.argv[2];
const cfg = defaultConfig(); cfg.system.precipHours=[0,6,12,18];
let n=0, ok=0; const bad=[]; const kinds={};
for (const f of fs.readdirSync(dir)) {
  const recs = parseSynFile(fs.readFileSync(dir+'/'+f,'latin1'));
  for (const r of recs) {
    const o = synRecordToObs(r); cfg.station.index = r.text.split(/\s+/)[2];
    const v = {...o.v};
    if (v.RRR==null){ v.RRR=null; }
    const enc = encodeSynop(o, v, cfg).text;
    n++;
    const a = r.text.replace(/\s+/g,' '), b = enc.replace(/\s+/g,' ');
    if (a===b) ok++; else {
      const ta=a.split(' '), tb=b.split(' ');
      let k=0; while(k<ta.length && ta[k]===tb[k]) k++;
      const key=(ta[k]||'END').slice(0,1)+'/'+(tb[k]||'END').slice(0,1)+'@'+k;
      kinds[key]=(kinds[key]||0)+1; if (bad.length<400) bad.push([a,b]);
    }
  }
}
console.log('total',n,'iguales',ok,(100*ok/n).toFixed(2)+'%');
console.log(Object.entries(kinds).sort((x,y)=>y[1]-x[1]).slice(0,15));
for (const [a,b] of bad.filter((_, i)=>i%40===0)) console.log('L:',a,'\nN:',b);
