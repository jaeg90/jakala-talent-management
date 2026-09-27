import { useState } from 'react';
import type { Manager } from './api';
import { api } from './api';

export function Login({ onSuccess }: { onSuccess: (manager: Manager) => void }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      const { manager } = await api.login(email, password);
      onSuccess(manager);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <main className="login">
      <h1>JTM</h1>
      <p className="subtitle">Jakala Talent Management</p>
      <form onSubmit={handleSubmit}>
        <label>
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            required
          />
        </label>
        <label>
          Contraseña
          <input
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            required
          />
        </label>
        {error !== null && <p className="error">{error}</p>}
        <button type="submit">Iniciar sesión</button>
      </form>
    </main>
  );
}
