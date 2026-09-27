import { useEffect, useState } from 'react';
import type { Manager } from './api';
import { api } from './api';
import { Login } from './Login';
import { Team } from './Team';

type AuthState =
  | { status: 'checking' }
  | { status: 'anonymous' }
  | { status: 'authenticated'; manager: Manager };

export function App() {
  const [auth, setAuth] = useState<AuthState>({ status: 'checking' });

  useEffect(() => {
    api
      .session()
      .then(({ manager }) => setAuth({ status: 'authenticated', manager }))
      .catch(() => setAuth({ status: 'anonymous' }));
  }, []);

  if (auth.status === 'checking') return <p className="status">Cargando…</p>;
  if (auth.status === 'anonymous') {
    return <Login onSuccess={(manager) => setAuth({ status: 'authenticated', manager })} />;
  }
  return (
    <Team
      manager={auth.manager}
      onLogout={() => setAuth({ status: 'anonymous' })}
    />
  );
}
