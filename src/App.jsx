import { useState } from 'react';
import { AppShell } from './app/AppShell';
import { ToastProvider } from './app/ui/Toast';
import { LoginPage } from './features/auth/LoginPage';
import { useAuth } from './hooks/useAuth';
import { LoadingOverlay } from './shared/ui/LoadingOverlay';

function App() {
  const [processingCount, setProcessingCount] = useState(0);

  function startProcessing() {
    setProcessingCount((count) => count + 1);
    return () => setProcessingCount((count) => Math.max(count - 1, 0));
  }

  const { user, setUser, isAuthenticated, setIsAuthenticated, logout } = useAuth(startProcessing);

  return (
    <ToastProvider>
      {isAuthenticated && user ? (
        <AppShell user={user} onLogout={logout} />
      ) : (
        <LoginPage setUser={setUser} setIsAuthenticated={setIsAuthenticated} startProcessing={startProcessing} />
      )}
      {processingCount > 0 && <LoadingOverlay />}
    </ToastProvider>
  );
}

export default App;
