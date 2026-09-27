import { useEffect, useState } from 'react';
import { api, TEMAS_GENERICOS, type AcuerdoView, type OneToOne } from './api';

interface Props {
  menteeId: string;
  menteeName: string;
  onBack: () => void;
}

interface Ficha {
  history: OneToOne[];
  pending: AcuerdoView[];
}

/** Ficha de una mentee: historial de 1-to-1s, acuerdos pendientes y registro de 1-to-1s. */
export function MenteeDetail({ menteeId, menteeName, onBack }: Props) {
  const [ficha, setFicha] = useState<Ficha | null>(null);

  function reload() {
    api.ficha(menteeId).then(setFicha);
  }

  useEffect(reload, [menteeId]);

  async function marcarCumplido(acuerdoId: string) {
    await api.completeAgreement(acuerdoId);
    reload();
  }

  return (
    <main className="detail">
      <header>
        <button className="link" onClick={onBack}>← Mi equipo</button>
        <h1>{menteeName}</h1>
      </header>

      {ficha === null ? (
        <p className="status">Cargando…</p>
      ) : (
        <>
          <section aria-label="Acuerdos pendientes">
            <h2>Acuerdos pendientes</h2>
            {ficha.pending.length === 0 ? (
              <p className="empty">Sin acuerdos pendientes.</p>
            ) : (
              <ul className="pendientes">
                {ficha.pending.map((a) => (
                  <li key={a.id}>
                    <span>{a.text}</span>
                    <button onClick={() => void marcarCumplido(a.id)}>Marcar cumplido</button>
                  </li>
                ))}
              </ul>
            )}
          </section>

          <NuevoOneToOneForm menteeId={menteeId} onSaved={reload} />

          <section aria-label="Historial de 1-to-1s">
            <h2>Historial de 1-to-1s</h2>
            {ficha.history.length === 0 ? (
              <p className="empty">Todavía no hay 1-to-1s registrados.</p>
            ) : (
              <ol className="historial">
                {ficha.history.map((o) => (
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
        </>
      )}
    </main>
  );
}

/** Formulario de registro de un 1-to-1: temas genéricos con nota por tema + acuerdos. */
function NuevoOneToOneForm({ menteeId, onSaved }: { menteeId: string; onSaved: () => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [acuerdoTexto, setAcuerdoTexto] = useState('');
  const [acuerdos, setAcuerdos] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  function addAcuerdo() {
    const text = acuerdoTexto.trim();
    if (text === '') return;
    setAcuerdos([...acuerdos, text]);
    setAcuerdoTexto('');
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await api.saveOneToOne(menteeId, {
        date,
        notas: TEMAS_GENERICOS.filter((t) => notas[t]?.trim() !== '').map((t) => ({
          tema: t,
          nota: notas[t] ?? '',
        })),
        acuerdos: acuerdos.map((text) => ({ text })),
      });
      setNotas({});
      setAcuerdos([]);
      onSaved();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <section aria-label="Registrar 1-to-1">
      <h2>Registrar 1-to-1</h2>
      <form onSubmit={handleSubmit}>
        <label>
          Fecha
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} required />
        </label>
        {TEMAS_GENERICOS.map((tema) => (
          <label key={tema}>
            {tema}
            <input
              type="text"
              value={notas[tema] ?? ''}
              onChange={(e) => setNotas({ ...notas, [tema]: e.target.value })}
              placeholder="Nota (opcional)"
            />
          </label>
        ))}
        <div className="acuerdos-input">
          <label>
            Nuevo acuerdo
            <input
              type="text"
              value={acuerdoTexto}
              onChange={(e) => setAcuerdoTexto(e.target.value)}
              placeholder="Compromiso que nace de este 1-to-1"
            />
          </label>
          <button type="button" onClick={addAcuerdo}>Añadir acuerdo</button>
        </div>
        {acuerdos.length > 0 && (
          <ul className="acuerdos-nuevos">
            {acuerdos.map((text, i) => (
              <li key={i}>{text}</li>
            ))}
          </ul>
        )}
        {error !== null && <p className="error">{error}</p>}
        <button type="submit">Registrar 1-to-1</button>
      </form>
    </section>
  );
}
