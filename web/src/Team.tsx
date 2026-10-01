import { useEffect, useState } from 'react';
import type { ManagerAutenticado, Mentee } from './api';
import { api } from './api';
import { MenteeDetail } from './MenteeDetail';
import { IncidenciasView } from './IncidenciasView';
import { ProyectosView } from './ProyectosView';

export function Team({ manager, onLogout }: { manager: ManagerAutenticado; onLogout: () => void }) {
  const [mentees, setMentees] = useState<Mentee[] | null>(null);
  const [abierta, setAbierta] = useState<Mentee | null>(null);
  const [viendoIncidencias, setViendoIncidencias] = useState(false);
  const [viendoProyectos, setViendoProyectos] = useState(false);

  function reloadTeam() {
    api
      .team()
      .then(({ mentees }) => setMentees(mentees))
      .catch(() => setMentees([]));
  }

  useEffect(() => {
    reloadTeam();
  }, []);

  async function handleLogout() {
    await api.logout();
    onLogout();
  }

  if (abierta !== null) {
    return (
      <MenteeDetail
        menteeId={abierta.id}
        menteeName={abierta.name}
        manager={manager}
        onBack={() => {
          setAbierta(null);
          reloadTeam();
        }}
      />
    );
  }

  if (viendoIncidencias) {
    return <IncidenciasView onBack={() => setViendoIncidencias(false)} />;
  }

  if (viendoProyectos) {
    return <ProyectosView onBack={() => setViendoProyectos(false)} />;
  }

  return (
    <main className="team">
      <header>
        <h1>Mi equipo</h1>
        <div>
          <button className="link" onClick={() => setViendoIncidencias(true)}>Incidencias</button>
          <button className="link" onClick={() => setViendoProyectos(true)}>Proyectos</button>
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
