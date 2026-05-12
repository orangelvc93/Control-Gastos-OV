import { useState } from 'react';
import { supabase } from '../../api/supabaseClient';
import { Button } from '../../shared/ui/Button';

export function LoginPage({ setUser, setIsAuthenticated, startProcessing = () => () => {} }) {
  const [loginForm, setLoginForm] = useState({ email: '', password: '' });
  const [loginError, setLoginError] = useState('');

  async function login(event) {
    event.preventDefault();
    const stopProcessing = startProcessing();
    try {
      const { data: authData, error } = await supabase.auth.signInWithPassword({
        email: loginForm.email.trim().toLowerCase(),
        password: loginForm.password,
      });

      if (!error) {
        setUser(authData.user);
        setIsAuthenticated(true);
        setLoginError('');
        return;
      }

      setLoginError(error.message || 'Email o contrasena incorrectos');
    } finally {
      stopProcessing();
    }
  }

  return (
    <main className="login-shell">
      <form className="login-card" onSubmit={login}>
        <p className="eyebrow">Acceso privado</p>
        <h1>Control de gastos</h1>
        <p>Ingresa con el usuario creado en Supabase.</p>
        <input
          type="email"
          placeholder="Email"
          value={loginForm.email}
          onChange={(event) => setLoginForm({ ...loginForm, email: event.target.value })}
          required
          autoFocus
        />
        <input
          type="password"
          placeholder="Contrasena"
          value={loginForm.password}
          onChange={(event) => setLoginForm({ ...loginForm, password: event.target.value })}
          required
        />
        {loginError && <strong className="login-error">{loginError}</strong>}
        <Button type="submit">Entrar</Button>
        <small>Los usuarios se administran manualmente desde Supabase Auth.</small>
      </form>
    </main>
  );
}
