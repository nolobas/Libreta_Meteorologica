const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('api', {
  dataDir: () => ipcRenderer.invoke('data:dir'),
  read: (rel) => ipcRenderer.invoke('data:read', rel),
  write: (rel, obj) => ipcRenderer.invoke('data:write', rel, obj),
  list: (rel) => ipcRenderer.invoke('data:list', rel),
  remove: (rel) => ipcRenderer.invoke('data:remove', rel),
  chooseDataDir: () => ipcRenderer.invoke('data:chooseDir'),
  openDataDir: () => ipcRenderer.invoke('data:openDir'),
  info: () => ipcRenderer.invoke('app:info'),
  saveFile: (opts) => ipcRenderer.invoke('file:save', opts),
  backup: (opts) => ipcRenderer.invoke('backup:create', opts),
  restore: () => ipcRenderer.invoke('backup:restore'),
  importLegacy: (opts) => ipcRenderer.invoke('legacy:import', opts),
  print: () => ipcRenderer.invoke('print'),
  printPDF: (name) => ipcRenderer.invoke('print:pdf', name),
  onTheme: (cb) => ipcRenderer.on('theme', (_e, t) => cb(t)),
});
