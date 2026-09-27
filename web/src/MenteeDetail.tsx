import { useEffect, useState } from 'react';
import {
  api,
  TEMAS_GENERICOS,
  type AcuerdoView,
  type Objetivo,
  type ObjetivoFields,
  type OneToOne,
  type TemaPropio,
} from './api';

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
  const [temas, setTemas] = useState<TemaPropio[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);

  function reload() {
    api.ficha(menteeId).then(setFicha);
  }

  function reloadTemas() {
    api.temasPropios(menteeId).then(({ temas }) => setTemas(temas));
  }

  function reloadObjetivos() {
    api.objetivos(menteeId).then(({ objetivos: o }) => setObjetivos(o));
  }

  useEffect(() => {
    reload();
    reloadTemas();
    reloadObjetivos();
  }, [menteeId]);

  async function marcarCumplido(acuerdoId: string) {
    await api.completeAgreement(acuerdoId);
    reload();
  }

  async function altaTema(nombre: string) {
    await api.addTemaPropio(menteeId, nombre);
    reloadTemas();
  }

  async function bajaTema(temaPropioId: string) {
    await api.removeTemaPropio(menteeId, temaPropioId);
    reloadTemas();
  }

  async function altaObjetivo(fields: ObjetivoFields) {
    await api.addObjetivo(menteeId, fields);
    reloadObjetivos();
  }

  async function cambiarEstadoObjetivo(objetivoId: string, estado: 'cumplido' | 'no cumplido') {
    await api.cambiarEstadoObjetivo(objetivoId, estado);
    reloadObjetivos();
  }

  async function editarObjetivo(objetivoId: string, fields: ObjetivoFields) {
    await api.updateObjetivo(objetivoId, fields);
    reloadObjetivos();
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

          <TemasPropios temas={temas} onAlta={altaTema} onBaja={bajaTema} />

          <Objetivos
            objetivos={objetivos}
            onAdd={altaObjetivo}
            onCambiarEstado={cambiarEstadoObjetivo}
            onUpdate={editarObjetivo}
          />

          <NuevoOneToOneForm menteeId={menteeId} temasPropios={temas} onSaved={reload} />

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

/** Alta y baja de temas propios de una mentee. */
function TemasPropios({
  temas,
  onAlta,
  onBaja,
}: {
  temas: TemaPropio[];
  onAlta: (nombre: string) => Promise<void>;
  onBaja: (temaPropioId: string) => Promise<void>;
}) {
  const [nombre, setNombre] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleAlta(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onAlta(nombre);
      setNombre('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <section aria-label="Temas propios">
      <h2>Temas propios</h2>
      {temas.length === 0 ? (
        <p className="empty">Sin temas propios.</p>
      ) : (
        <ul className="pendientes">
          {temas.map((t) => (
            <li key={t.id}>
              <span>{t.tema}</span>
              <button onClick={() => void onBaja(t.id)}>Retirar</button>
            </li>
          ))}
        </ul>
      )}
      <form onSubmit={handleAlta}>
        <label>
          Nuevo tema propio
          <input
            type="text"
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="p. ej. formación en curso"
          />
        </label>
        {error !== null && <p className="error">{error}</p>}
        <button type="submit">Añadir tema</button>
      </form>
    </section>
  );
}

/** Formulario de registro de un 1-to-1: temas genéricos + propios con nota por tema + acuerdos. */
function NuevoOneToOneForm({
  menteeId,
  temasPropios,
  onSaved,
}: {
  menteeId: string;
  temasPropios: TemaPropio[];
  onSaved: () => void;
}) {
  const temas = [...TEMAS_GENERICOS, ...temasPropios.map((t) => t.tema)];
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
        notas: temas.filter((t) => notas[t]?.trim() !== '').map((t) => ({
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
        {temas.map((tema) => (
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

/** Objetivos anuales SMART de una mentee: alta, edición en curso y cambio de estado. */
function Objetivos({
  objetivos,
  onAdd,
  onCambiarEstado,
  onUpdate,
}: {
  objetivos: Objetivo[];
  onAdd: (fields: ObjetivoFields) => Promise<void>;
  onCambiarEstado: (objetivoId: string, estado: 'cumplido' | 'no cumplido') => Promise<void>;
  onUpdate: (objetivoId: string, fields: ObjetivoFields) => Promise<void>;
}) {
  const [editandoId, setEditandoId] = useState<string | null>(null);

  async function handleUpdate(objetivoId: string, fields: ObjetivoFields) {
    await onUpdate(objetivoId, fields);
    setEditandoId(null);
  }

  return (
    <section aria-label="Objetivos anuales">
      <h2>Objetivos anuales</h2>
      {objetivos.length === 0 ? (
        <p className="empty">Sin objetivos.</p>
      ) : (
        <ul className="objetivos">
          {objetivos.map((o) =>
            editandoId === o.id ? (
              <EditarObjetivoForm
                key={o.id}
                objetivo={o}
                onCancel={() => setEditandoId(null)}
                onSaved={(fields) => handleUpdate(o.id, fields)}
              />
            ) : (
              <li key={o.id} className="objetivo">
                <strong>{o.titulo}</strong>
                {o.descripcion !== '' && <p className="objetivo-descripcion">{o.descripcion}</p>}
                <p className="objetivo-meta">Fecha límite: {o.fechaLimite} · Estado: {o.estado}</p>
                {o.estado === 'en curso' && (
                  <div className="objetivo-acciones">
                    <button onClick={() => void onCambiarEstado(o.id, 'cumplido')}>Cumplido</button>
                    <button onClick={() => void onCambiarEstado(o.id, 'no cumplido')}>No cumplido</button>
                    <button className="link" onClick={() => setEditandoId(o.id)}>Editar</button>
                  </div>
                )}
              </li>
            ),
          )}
        </ul>
      )}
      <NuevoObjetivoForm onAdd={onAdd} />
    </section>
  );
}

/** Formulario de alta de un objetivo anual. */
function NuevoObjetivoForm({ onAdd }: { onAdd: (fields: ObjetivoFields) => Promise<void> }) {
  const [titulo, setTitulo] = useState('');
  const [descripcion, setDescripcion] = useState('');
  const [fechaLimite, setFechaLimite] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onAdd({ titulo, descripcion, fechaLimite });
      setTitulo('');
      setDescripcion('');
      setFechaLimite('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Nuevo objetivo">
      <label>
        Título
        <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
      </label>
      <label>
        Descripción
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
        />
      </label>
      <label>
        Fecha límite
        <input
          type="date"
          value={fechaLimite}
          onChange={(e) => setFechaLimite(e.target.value)}
          required
        />
      </label>
      {error !== null && <p className="error">{error}</p>}
      <button type="submit">Añadir objetivo</button>
    </form>
  );
}

/** Formulario de edición de un objetivo en curso. */
function EditarObjetivoForm({
  objetivo,
  onCancel,
  onSaved,
}: {
  objetivo: Objetivo;
  onCancel: () => void;
  onSaved: (fields: ObjetivoFields) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState(objetivo.titulo);
  const [descripcion, setDescripcion] = useState(objetivo.descripcion);
  const [fechaLimite, setFechaLimite] = useState(objetivo.fechaLimite);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onSaved({ titulo, descripcion, fechaLimite });
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <li className="objetivo">
      <form onSubmit={handleSubmit} aria-label="Editar objetivo">
        <label>
          Título
          <input type="text" value={titulo} onChange={(e) => setTitulo(e.target.value)} required />
        </label>
        <label>
          Descripción
          <input
            type="text"
            value={descripcion}
            onChange={(e) => setDescripcion(e.target.value)}
          />
        </label>
        <label>
          Fecha límite
          <input
            type="date"
            value={fechaLimite}
            onChange={(e) => setFechaLimite(e.target.value)}
            required
          />
        </label>
        {error !== null && <p className="error">{error}</p>}
        <button type="submit">Guardar</button>
        <button type="button" className="link" onClick={onCancel}>Cancelar</button>
      </form>
    </li>
  );
}
