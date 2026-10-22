// Tema de la app: 'sistema' (sigue al celular o la computadora), 'claro' u 'oscuro'.
// Se guarda en este dispositivo y se aplica como data-theme en <html> (index.html lo aplica antes del primer dibujo).

export const THEME_KEY = 'cg-tema';
const META_COLORS = { light: '#4d4845', dark: '#0b0912' };
const systemQuery = () => window.matchMedia('(prefers-color-scheme: light)');

export function readThemePref() {
  try {
    const value = window.localStorage.getItem(THEME_KEY);
    return value === 'claro' || value === 'oscuro' ? value : 'sistema';
  } catch {
    return 'sistema';
  }
}

export function resolveTheme(pref) {
  if (pref === 'claro') return 'light';
  if (pref === 'oscuro') return 'dark';
  return systemQuery().matches ? 'light' : 'dark';
}

export function applyTheme(pref) {
  const theme = resolveTheme(pref);
  document.documentElement.dataset.theme = theme;
  document.querySelector('meta[name="theme-color"]')?.setAttribute('content', META_COLORS[theme]);
}

export function saveThemePref(pref) {
  try {
    window.localStorage.setItem(THEME_KEY, pref);
  } catch {
    // Sin almacenamiento: el tema dura mientras la app esté abierta.
  }
  applyTheme(pref);
}

// En modo 'sistema', cambia solo cuando el sistema pasa de claro a oscuro.
export function watchSystemTheme() {
  const query = systemQuery();
  const onChange = () => {
    if (readThemePref() === 'sistema') applyTheme('sistema');
  };
  query.addEventListener('change', onChange);
  return () => query.removeEventListener('change', onChange);
}
