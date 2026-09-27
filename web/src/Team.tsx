import { useEffect, useState } from 'react';
import type { Manager, Mentee } from './api';
import { api } from './api';

export function Team({ manager, onLogout }: { manager: Manager; onLogout: () => void }) {
  const [mentees, setMentees] = useState<Mentee[] | null>(null);

  useEffect(() => {
    api
      .team()
      .then(({ mentees }) => setMentees(mentees))
      .catch(() => setMentees([]));
  }, []);

  async function handleLogout() {
    await api.logout();
    onLogout();
  }

  return (
    <main className="team">
      <header>
        <h1>Mi equipo</h1>
        <div>
          <span>{manager.name}</span>
          <button onClick={handleLogout}>Cerrar sesión</button>
        </div>
      </header>
      {mentees === null ? (
        <p className="status">Cargando…</p>
      ) : mentees.length === 0 ? (
        <p className="empty">Todavía no hay mentees en tu equipo.</p>
      ) : (
        <ul>
          {mentees.map((m) => (
            <li key={m.id}>{m.name}</li>
          ))}
        </ul>
      )}
    </main>
  );
}
