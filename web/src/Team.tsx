import { useEffect, useState } from 'react';
import type { Manager, Mentee } from './api';
import { api } from './api';
import { MenteeDetail } from './MenteeDetail';

export function Team({ manager, onLogout }: { manager: Manager; onLogout: () => void }) {
  const [mentees, setMentees] = useState<Mentee[] | null>(null);
  const [abierta, setAbierta] = useState<Mentee | null>(null);

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

  if (abierta !== null) {
    return <MenteeDetail menteeId={abierta.id} menteeName={abierta.name} onBack={() => setAbierta(null)} />;
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
        <ul className="mentee-list">
          {mentees.map((m) => (
            <li key={m.id}>
              <button className="link mentee-name" onClick={() => setAbierta(m)}>{m.name}</button>
              <span className="mentee-project">{m.project?.name ?? 'Sin proyecto'}</span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
