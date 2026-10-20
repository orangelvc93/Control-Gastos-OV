import { useCallback, useEffect, useState } from 'react';

// Rutas por hash (#/cuentas/abc): funcionan en Netlify y en la app instalada sin configurar el servidor,
// y al recargar se vuelve a la misma pantalla.
function currentPath() {
  return window.location.hash.replace(/^#/, '') || '/';
}

export function useHashRoute() {
  const [path, setPath] = useState(currentPath);

  useEffect(() => {
    const onChange = () => {
      setPath(currentPath());
      window.scrollTo({ top: 0 });
    };
    window.addEventListener('hashchange', onChange);
    return () => window.removeEventListener('hashchange', onChange);
  }, []);

  const navigate = useCallback((next) => {
    window.location.hash = next;
  }, []);

  return [path, navigate];
}
