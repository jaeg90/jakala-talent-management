import { useEffect, useState } from 'react';
import type { MiembrosPorProyecto, Project } from './api';
import { api } from './api';

/**
 * Vista de proyectos: el catálogo (visible y ampliable) y "quién está en cada
 * proyecto" (los mentees del manager agrupados por su proyecto actual).
 */
export function ProyectosView({ onBack }: { onBack: () => void }) {
  const [catalogo, setCatalogo] = useState<Project[] | null>(null);
  const [miembros, setMiembros] = useState<MiembrosPorProyecto[] | null>(null);

  function reload() {
    api.proyectos().then(({ proyectos }) => setCatalogo(proyectos));
    api.miembrosPorProyecto().then(({ proyectos }) => setMiembros(proyectos));
  }

  useEffect(() => {
    reload();
  }, []);

  async function addProyecto(name: string) {
    await api.addProyecto(name);
    reload();
  }

  return (
    <main className="detail">
      <header>
        <button className="link" onClick={onBack}>← Mi equipo</button>
        <h1>Proyectos</h1>
      </header>

      <section aria-label="Catálogo de proyectos">
        <h2>Catálogo de proyectos</h2>
        {catalogo === null ? (
          <p className="status">Cargando…</p>
        ) : catalogo.length === 0 ? (
          <p className="empty">Todavía no hay proyectos.</p>
        ) : (
          <ul className="objetivos">
            {catalogo.map((p) => (
              <li key={p.id} className="objetivo">{p.name}</li>
            ))}
          </ul>
        )}
        <NuevoProyectoForm onAdd={addProyecto} />
      </section>

      <section aria-label="Quién está en cada proyecto">
        <h2>Quién está en cada proyecto</h2>
        {miembros === null ? (
          <p className="status">Cargando…</p>
        ) : miembros.length === 0 ? (
          <p className="empty">Todavía no hay nadie en ningún proyecto.</p>
        ) : (
          <ul className="objetivos">
            {miembros.map((grupo) => (
              <li key={grupo.projectId ?? 'sin-proyecto'} className="objetivo">
                <strong>{grupo.projectName ?? 'Sin proyecto'}</strong>
                <ul className="notas">
                  {grupo.mentees.map((m) => (
                    <li key={m.id}>{m.name}</li>
                  ))}
                </ul>
              </li>
            ))}
          </ul>
        )}
      </section>
    </main>
  );
}

/** Formulario de alta de un proyecto en el catálogo. */
function NuevoProyectoForm({ onAdd }: { onAdd: (name: string) => Promise<void> }) {
  const [name, setName] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onAdd(name);
      setName('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Nuevo proyecto">
      <label>
        Nombre
        <input
          type="text"
          value={name}
          onChange={(e) => setName(e.target.value)}
          placeholder="p. ej. nuevo cliente"
          required
        />
      </label>
      {error !== null && <p className="error">{error}</p>}
      <button type="submit">Añadir proyecto</button>
    </form>
  );
}