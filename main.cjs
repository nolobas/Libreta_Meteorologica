// Libreta Meteorológica — proceso principal (Electron)
const { app, BrowserWindow, ipcMain, dialog, shell, nativeTheme, Menu } = require('electron');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');
const fflate = require('fflate');

const APP_NAME = 'Libreta Meteorológica';
app.setName(APP_NAME);
if (process.platform === 'win32') app.setAppUserModelId('ar.libreta.meteorologica');

let win = null;
const settingsFile = () => path.join(app.getPath('userData'), 'settings.json');

function loadSettings() {
  try { return JSON.parse(fs.readFileSync(settingsFile(), 'utf8')); } catch { return {}; }
}
function saveSettings(s) {
  fs.mkdirSync(path.dirname(settingsFile()), { recursive: true });
  fs.writeFileSync(settingsFile(), JSON.stringify(s, null, 2));
}
function dataDir() {
  const s = loadSettings();
  const d = s.dataDir || process.env.LIBRETA_DATA || path.join(app.getPath('documents'), APP_NAME);
  fs.mkdirSync(d, { recursive: true });
  return d;
}
function safe(rel) {
  const base = dataDir();
  const p = path.resolve(base, rel);
  if (!p.startsWith(path.resolve(base))) throw new Error('Ruta no permitida');
  return p;
}
function writeAtomic(p, text) {
  fs.mkdirSync(path.dirname(p), { recursive: true });
  const tmp = p + '.tmp';
  fs.writeFileSync(tmp, text);
  fs.renameSync(tmp, p);
}

function createWindow() {
  const dark = nativeTheme.shouldUseDarkColors;
  win = new BrowserWindow({
    width: 1360, height: 860, minWidth: 1024, minHeight: 680,
    title: APP_NAME,
    backgroundColor: dark ? '#202020' : '#f3f3f3',
    icon: path.join(__dirname, 'build', 'icon.png'),
    titleBarStyle: 'hidden',
    titleBarOverlay: { color: '#00000000', symbolColor: dark ? '#ffffff' : '#1b1b1b', height: 40 },
    backgroundMaterial: 'mica',
    show: false,
    webPreferences: {
      preload: path.join(__dirname, 'preload.cjs'),
      contextIsolation: true, nodeIntegration: false, sandbox: true, spellcheck: false,
    },
  });
  Menu.setApplicationMenu(null);
  win.loadFile(path.join(__dirname, 'src', 'index.html'));
  win.once('ready-to-show', () => {
    win.show();
    if (process.env.LIBRETA_DEBUG) { try { require(process.env.LIBRETA_DEBUG)(win, app); } catch (e) { console.error(e); } }
  });
  nativeTheme.on('updated', () => {
    const d = nativeTheme.shouldUseDarkColors;
    try { win.setTitleBarOverlay({ color: '#00000000', symbolColor: d ? '#ffffff' : '#1b1b1b', height: 40 }); } catch { /* */ }
    win.webContents.send('theme', d ? 'dark' : 'light');
  });
  win.webContents.setWindowOpenHandler(({ url }) => { shell.openExternal(url); return { action: 'deny' }; });
}

// ------------------------------------------------------------------ IPC: datos
ipcMain.handle('data:dir', () => dataDir());
ipcMain.handle('data:read', (_e, rel) => {
  try { return JSON.parse(fs.readFileSync(safe(rel), 'utf8')); } catch { return null; }
});
ipcMain.handle('data:write', (_e, rel, obj) => { writeAtomic(safe(rel), JSON.stringify(obj, null, 1)); return true; });
ipcMain.handle('data:list', (_e, rel) => {
  try { return fs.readdirSync(safe(rel)).filter((f) => f.endsWith('.json')).sort(); } catch { return []; }
});
ipcMain.handle('data:remove', (_e, rel) => { try { fs.unlinkSync(safe(rel)); return true; } catch { return false; } });
ipcMain.handle('data:chooseDir', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Elegir la carpeta de datos', properties: ['openDirectory', 'createDirectory'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const s = loadSettings(); s.dataDir = r.filePaths[0]; saveSettings(s);
  return r.filePaths[0];
});
ipcMain.handle('data:openDir', () => shell.openPath(dataDir()));
ipcMain.handle('app:info', () => ({ version: app.getVersion(), platform: process.platform, dark: nativeTheme.shouldUseDarkColors }));

// ------------------------------------------------------------------ IPC: archivos
ipcMain.handle('file:save', async (_e, { defaultName, content, filters, encoding }) => {
  const r = await dialog.showSaveDialog(win, {
    title: 'Guardar archivo', defaultPath: path.join(app.getPath('documents'), defaultName),
    filters: filters || [{ name: 'Texto', extensions: ['txt'] }],
  });
  if (r.canceled || !r.filePath) return null;
  const ext = path.extname(r.filePath).toLowerCase();
  fs.writeFileSync(r.filePath, encoding === 'latin1' ? Buffer.from(content, 'latin1') : (ext === '.csv' ? '\ufeff' : '') + content);
  return r.filePath;
});

function collectFiles(base, filter) {
  const out = {};
  const walk = (dir, rel) => {
    for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, f.name); const r = rel ? rel + '/' + f.name : f.name;
      if (f.isDirectory()) walk(p, r);
      else if (!f.name.endsWith('.tmp') && (!filter || filter(r))) out[r] = new Uint8Array(fs.readFileSync(p));
    }
  };
  walk(base, '');
  return out;
}

ipcMain.handle('backup:create', async (_e, { months, defaultName }) => {
  const base = dataDir();
  const filter = months && months.length
    ? (r) => r === 'config.json' || months.some((m) => r.endsWith('/' + m + '.json'))
    : null;
  const files = collectFiles(base, filter);
  if (!Object.keys(files).length) return { error: 'No hay datos para respaldar.' };
  const r = await dialog.showSaveDialog(win, {
    title: 'Guardar respaldo', defaultPath: path.join(app.getPath('documents'), defaultName || 'Respaldo Libreta.zip'),
    filters: [{ name: 'Respaldo comprimido', extensions: ['zip'] }],
  });
  if (r.canceled || !r.filePath) return null;
  const zipped = fflate.zipSync(files, { level: 6 });
  fs.writeFileSync(r.filePath, zipped);
  return { path: r.filePath, count: Object.keys(files).length, bytes: zipped.length };
});

ipcMain.handle('backup:restore', async () => {
  const r = await dialog.showOpenDialog(win, { title: 'Elegir respaldo', filters: [{ name: 'Respaldo', extensions: ['zip'] }], properties: ['openFile'] });
  if (r.canceled || !r.filePaths[0]) return null;
  const files = fflate.unzipSync(new Uint8Array(fs.readFileSync(r.filePaths[0])));
  const base = dataDir(); let n = 0;
  for (const [name, data] of Object.entries(files)) {
    if (name.endsWith('/') || !name.endsWith('.json')) continue;
    const p = path.resolve(base, name);
    if (!p.startsWith(path.resolve(base))) continue;
    fs.mkdirSync(path.dirname(p), { recursive: true });
    fs.writeFileSync(p, Buffer.from(data)); n++;
  }
  return { count: n };
});

// ------------------------------------------------------------------ IPC: importar LIBRETA (MS-DOS)
ipcMain.handle('legacy:import', async (_e, opts = {}) => {
  let dir = opts.dir;
  if (!dir) {
    const r = await dialog.showOpenDialog(win, { title: 'Elegir la carpeta LIBRETA del programa anterior', properties: ['openDirectory'] });
    if (r.canceled || !r.filePaths[0]) return null;
    dir = r.filePaths[0];
  }
  const find = (...parts) => {
    // búsqueda sin distinguir mayúsculas
    let cur = dir;
    for (const p of parts) {
      if (!fs.existsSync(cur)) return null;
      const hit = fs.readdirSync(cur).find((f) => f.toLowerCase() === p.toLowerCase());
      if (!hit) return null;
      cur = path.join(cur, hit);
    }
    return cur;
  };
  let root = dir;
  if (!find('DAT') && find('LIBRETA', 'DAT')) root = find('LIBRETA');
  const f2 = (...p) => { const save = dir; dir = root; const r = find(...p); dir = save; return r; };
  const L = await import(pathToFileURL(path.join(__dirname, 'src', 'lib', 'legacy.js')).href);
  const read = (p) => (p && fs.existsSync(p) ? fs.readFileSync(p, 'latin1') : null);

  const result = { station: null, corrections: null, limits: null, obs: {}, reg: {}, stations: {} };
  const est = read(f2('ARCH', 'ESTAC.DAT')); if (est) result.station = L.parseEstac(est);
  const cor = read(f2('ARCH', 'CORREC.DAT')); if (cor) result.corrections = L.parseCorrec(cor);
  const lim = read(f2('ARCH', 'LIMT.DAT')); if (lim) result.limits = L.parseLimt(lim);
  const only = opts.station || (result.station && result.station.code) || null;

  const synDir = f2('DAT', 'SYN');
  let nObs = 0;
  if (synDir) {
    for (const f of fs.readdirSync(synDir)) {
      if (!/\.syn$/i.test(f)) continue;
      const code = f.slice(0, 3);
      result.stations[code] = (result.stations[code] || 0) + 1;
      if (only && code !== only) continue;
      for (const rec of L.parseSynFile(fs.readFileSync(path.join(synDir, f), 'latin1'))) {
        const ym = rec.date.slice(0, 7);
        (result.obs[ym] ||= {})[`${rec.date.slice(8, 10)}-${String(rec.hour).padStart(2, '0')}`] = L.synRecordToObs(rec);
        nObs++;
      }
    }
  }
  const grafDir = f2('DAT', 'GRAF');
  let nReg = 0;
  if (grafDir) {
    for (const f of fs.readdirSync(grafDir)) {
      const m = f.match(/^(\d{3})\d{5}\.(TE[12]|HI[12]|BA[12]|HE[12])$/i);
      if (!m || (only && m[1] !== only)) continue;
      for (const r of L.parseGrafFile(fs.readFileSync(path.join(grafDir, f), 'latin1'), m[2].toUpperCase())) {
        const ym = r.date.slice(0, 7);
        const day = ((result.reg[ym] ||= {})[r.date] ||= {});
        const arr = (day[r.param] ||= Array(24).fill(null));
        r.vals.forEach((v, i) => { arr[r.startHour - 1 + i] = v; });
        nReg++;
      }
    }
  }
  // escribir (fusionando con lo existente; no se pisan datos cargados en el programa nuevo)
  const base = dataDir();
  for (const [ym, recs] of Object.entries(result.obs)) {
    const p = path.join(base, 'obs', ym + '.json');
    let cur = {}; try { cur = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* */ }
    for (const [k, o] of Object.entries(recs)) if (!cur[k] || cur[k].imported) cur[k] = o;
    writeAtomic(p, JSON.stringify(cur, null, 1));
  }
  for (const [ym, days] of Object.entries(result.reg)) {
    const p = path.join(base, 'reg', ym + '.json');
    let cur = {}; try { cur = JSON.parse(fs.readFileSync(p, 'utf8')); } catch { /* */ }
    for (const [d, rec] of Object.entries(days)) if (!cur[d] || cur[d].imported) cur[d] = { ...rec, imported: true };
    writeAtomic(p, JSON.stringify(cur, null, 1));
  }
  return {
    dir: root, station: result.station, corrections: result.corrections, limits: result.limits,
    stations: result.stations, nObs, nReg, months: Object.keys(result.obs).sort(),
  };
});

ipcMain.handle('print', () => new Promise((res) => win.webContents.print({ printBackground: true }, (ok) => res(ok))));
ipcMain.handle('print:pdf', async (_e, defaultName) => {
  const r = await dialog.showSaveDialog(win, { title: 'Guardar como PDF', defaultPath: path.join(app.getPath('documents'), defaultName || 'Libreta.pdf'), filters: [{ name: 'PDF', extensions: ['pdf'] }] });
  if (r.canceled || !r.filePath) return null;
  const pdf = await win.webContents.printToPDF({ printBackground: true, landscape: true, pageSize: 'A4' });
  fs.writeFileSync(r.filePath, pdf);
  return r.filePath;
});

const lock = app.requestSingleInstanceLock();
if (!lock) app.quit();
else {
  app.on('second-instance', () => { if (win) { if (win.isMinimized()) win.restore(); win.focus(); } });
  app.whenReady().then(createWindow);
  app.on('window-all-closed', () => app.quit());
}
