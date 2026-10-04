import { useEffect, useState } from 'react';
import { useParams } from 'react-router';
import type { OneToOne } from './api';
import { api } from './api';

/** Lista temporal de 1-to-1s (ADR-0011; muere en #31). */
export function PuenteLista1to1() {
  const { id } = useParams();
  const [history, setHistory] = useState<OneToOne[] | null>(null);

  useEffect(() => {
    if (id === undefined) return;
    api.ficha(id).then((ficha) => setHistory(ficha.history));
  }, [id]);

  return (
    <section className="puente" aria-label="1-to-1s">
      <header className="ficha__cabecera">
        <h1>1-to-1s</h1>
      </header>
      {history === null ? (
        <p className="status">Cargando…</p>
      ) : history.length === 0 ? (
        <p className="empty">Todavía no hay 1-to-1s registrados.</p>
      ) : (
        <ol className="historial">
          {history.map((o) => (
            <li key={o.id}>
              <h3>{o.date}</h3>
              <ul className="notas">
                {o.notas.map((n) => (
                  <li key={n.tema}>
                    <strong>{n.tema}</strong> {n.nota}
                  </li>
                ))}
              </ul>
              {o.acuerdos.length > 0 && (
                <ul className="acuerdos-historial">
                  {o.acuerdos.map((a) => (
                    <li key={a.id} className={a.done ? 'cumplido' : ''}>
                      {a.done ? '✓ ' : '○ '}{a.text}
                    </li>
                  ))}
                </ul>
              )}
            </li>
          ))}
        </ol>
      )}
    </section>
  );
}
