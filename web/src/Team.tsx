import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router';
import type { Mentee } from './api';
import { api } from './api';
import { useAuth } from './auth';
import { IncidenciasView } from './IncidenciasView';
import { ProyectosView } from './ProyectosView';

/**
 * Mi equipo (vista actual, sin rediseñar — #17). Montada en `/equipo`; la ficha
 * pasa a su propia ruta (`/mentees/:id`) y las vistas globales de incidencias y
 * proyectos siguen aquí hasta que las retire #17.
 */
export function Team() {
  const { manager, logout } = useAuth();
  const navigate = useNavigate();
  const [mentees, setMentees] = useState<Mentee[] | null>(null);
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
          <span>{manager?.name}</span>
          <button onClick={() => void logout()}>Cerrar sesión</button>
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
              <button className="link mentee-name" onClick={() => navigate(`/mentees/${m.id}`)}>
                {m.name}
              </button>
              <span className="mentee-project">
                {m.proyectos.length > 0 ? m.proyectos.join(', ') : 'Sin proyecto'}
              </span>
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}