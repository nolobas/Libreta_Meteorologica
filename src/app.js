import { h, icon } from './lib/ui.js';
import { loadConfig, getConfig } from './lib/store.js';

const ROUTES = [
  { grp: 'Observación' },
  { id: 'inicio', label: 'Inicio', icon: 'home', mod: './views/inicio.js' },
  { id: 'libreta', label: 'Libreta de observaciones', icon: 'book', mod: './views/libreta.js', num: '2' },
  { id: 'registradores', label: 'Registradores', icon: 'gauge', mod: './views/registradores.js', num: '5' },
  { id: 'consultas', label: 'Visualización', icon: 'chart', mod: './views/consultas.js', num: '4' },
  { grp: 'Estación' },
  { id: 'estacion', label: 'Datos de la estación', icon: 'station', mod: './views/estacion.js', num: '3' },
  { id: 'sistema', label: 'Configuración del sistema', icon: 'tune', mod: './views/sistema.js', num: '1' },
  { id: 'admin', label: 'Administración', icon: 'shield', mod: './views/admin.js', num: '6' },
];

const nav = document.getElementById('nav');
const main = document.getElementById('main');
let current = null;
const routeState = {};

function applyTheme(t) { document.documentElement.dataset.theme = t; }
window.matchMedia('(prefers-color-scheme: dark)').addEventListener('change', (e) => applyTheme(e.matches ? 'dark' : 'light'));
applyTheme(window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light');
window.api?.onTheme?.(applyTheme);

export function updateStationChip() {
  const c = getConfig(); const chip = document.getElementById('station-chip');
  const st = c?.station || {};
  if (st.name || st.index) { chip.hidden = false; chip.textContent = `${st.name || 'Estación'}${st.index ? ' · ' + st.index : ''}`; } else chip.hidden = true;
}

function buildNav() {
  nav.replaceChildren(
    ...ROUTES.map((r) => (r.grp ? h('div', { class: 'grp' }, r.grp)
      : h('a', { href: '#' + r.id, 'data-id': r.id, title: r.num ? `Opción ${r.num} del menú original` : '' }, icon(r.icon), h('span', {}, r.label)))),
    h('div', { class: 'foot', id: 'nav-foot' }),
  );
}

export async function go(id, state) {
  const r = ROUTES.find((x) => x.id === id) || ROUTES[1];
  if (state) routeState[r.id] = state;
  if (location.hash !== '#' + r.id) { history.replaceState(null, '', '#' + r.id); }
  for (const a of nav.querySelectorAll('a')) a.classList.toggle('on', a.dataset.id === r.id);
  current = r.id;
  const mod = await import(r.mod);
  main.scrollTop = 0;
  const page = h('div', { class: 'page' });
  main.replaceChildren(page);
  try {
    await mod.render(page, { go, state: routeState[r.id] || {}, setState: (s) => { routeState[r.id] = { ...(routeState[r.id] || {}), ...s }; } });
  } catch (e) {
    console.error(e);
    page.append(h('div', { class: 'alert err' }, icon('err'), h('div', {}, 'Error al mostrar la pantalla: ' + e.message)));
  }
  window.__rendered = r.id;
}
window.__go = go;

window.addEventListener('hashchange', () => { const id = location.hash.slice(1); if (id && id !== current) go(id); });

async function start() {
  buildNav();
  await loadConfig();
  updateStationChip();
  const info = await window.api.info();
  document.getElementById('nav-foot').textContent = `Versión ${info.version}`;
  nav.addEventListener('click', (e) => { const a = e.target.closest('a[data-id]'); if (a) { e.preventDefault(); go(a.dataset.id); } });
  await go(location.hash.slice(1) || 'inicio');
}
document.addEventListener('keydown', (e) => {
  if (e.key === 'F4') { e.preventDefault(); go('inicio'); }
});
start();
