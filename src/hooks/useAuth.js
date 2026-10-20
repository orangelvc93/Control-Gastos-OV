import { useEffect, useState } from 'react';
import { supabase } from '../api/supabaseClient';

export function useAuth(startProcessing = () => () => {}) {
  const [user, setUser] = useState(null);
  const [isAuthenticated, setIsAuthenticated] = useState(false);

  useEffect(() => {
    let mounted = true;

    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!mounted) return;
      setUser(session?.user ?? null);
      setIsAuthenticated(Boolean(session?.user));
    });

    const { data: listener } = supabase.auth.onAuthStateChange((_event, session) => {
      const nextUser = session?.user ?? null;
      // Al refrescar el token llega un objeto nuevo del mismo usuario: se conserva el anterior para no recargar la app.
      setUser((current) => (current?.id === nextUser?.id ? current : nextUser));
      setIsAuthenticated(Boolean(session?.user));
    });

    return () => {
      mounted = false;
      listener.subscription.unsubscribe();
    };
  }, []);

  async function logout() {
    const stopProcessing = startProcessing();
    try {
      await supabase.auth.signOut();
      setUser(null);
      setIsAuthenticated(false);
    } finally {
      stopProcessing();
    }
  }

  return { user, setUser, isAuthenticated, setIsAuthenticated, logout };
}
