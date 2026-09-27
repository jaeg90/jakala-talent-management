import { useEffect, useState } from 'react';
import type { IncidenciaConMentee } from './api';
import { api } from './api';

/**
 * Vista de incidencias abiertas de todo el equipo del manager, con resolución
 * dejando una nota. Las resueltas desaparecen de aquí y pasan al historial de la ficha.
 */
export function IncidenciasView({ onBack }: { onBack: () => void }) {
  const [incidencias, setIncidencias] = useState<IncidenciaConMentee[] | null>(null);

  function reload() {
    api.incidenciasAbiertas().then(({ incidencias: list }) => setIncidencias(list));
  }

  useEffect(() => {
    reload();
  }, []);

  async function resolver(incidenciaId: string, nota: string) {
    await api.resolverIncidencia(incidenciaId, nota);
    reload();
  }

  return (
    <main className="detail">
      <header>
        <button className="link" onClick={onBack}>← Mi equipo</button>
        <h1>Incidencias abiertas</h1>
      </header>

      {incidencias === null ? (
        <p className="status">Cargando…</p>
      ) : incidencias.length === 0 ? (
        <p className="empty">No hay incidencias abiertas en tu equipo.</p>
      ) : (
        <ul className="objetivos">
          {incidencias.map((i) => (
            <li key={i.id} className="objetivo">
              <p className="objetivo-meta">{i.menteeName} · {i.fechaAlta}</p>
              <strong>{i.descripcion}</strong>
              <FormResolver onResolver={(nota) => resolver(i.id, nota)} />
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}

/** Formulario de resolución de una incidencia abierta: nota de resolución obligatoria. */
function FormResolver({ onResolver }: { onResolver: (nota: string) => Promise<void> }) {
  const [nota, setNota] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onResolver(nota);
      setNota('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Resolver incidencia">
      <label>
        Nota de resolución
        <input
          type="text"
          value={nota}
          onChange={(e) => setNota(e.target.value)}
          placeholder="Cómo se resolvió"
          required
        />
      </label>
      {error !== null && <p className="error">{error}</p>}
      <button type="submit">Resolver</button>
    </form>
  );
}