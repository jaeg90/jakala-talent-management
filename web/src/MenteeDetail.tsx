import { useEffect, useState } from 'react';
import {
  api,
  type AcuerdoView,
  type Incidencia,
  type Manager,
  type Objetivo,
  type ObjetivoFields,
  type OneToOne,
  type Project,
  type SituacionProyecto,
  type TemaPlantilla,
  type TemaPropio,
  type Traspaso,
} from './api';

interface Props {
  menteeId: string;
  menteeName: string;
  manager: Manager;
  onBack: () => void;
}

interface Ficha {
  history: OneToOne[];
  pending: AcuerdoView[];
}

/** Ficha de una mentee: historial de 1-to-1s, acuerdos pendientes y registro de 1-to-1s. */
export function MenteeDetail({ menteeId, menteeName, manager, onBack }: Props) {
  const [ficha, setFicha] = useState<Ficha | null>(null);
  const [temas, setTemas] = useState<TemaPropio[]>([]);
  const [plantilla, setPlantilla] = useState<TemaPlantilla[]>([]);
  const [objetivos, setObjetivos] = useState<Objetivo[]>([]);
  const [incidencias, setIncidencias] = useState<Incidencia[]>([]);

  function reload() {
    api.ficha(menteeId).then(setFicha);
  }

  function reloadTemas() {
    api.temasPropios(menteeId).then(({ temas }) => setTemas(temas));
  }

  function reloadPlantilla() {
    api.plantilla().then(({ temas: t }) => setPlantilla(t));
  }

  function reloadObjetivos() {
    api.objetivos(menteeId).then(({ objetivos: o }) => setObjetivos(o));
  }

  function reloadIncidencias() {
    api.incidenciasDe(menteeId).then(({ incidencias: list }) => setIncidencias(list));
  }

  useEffect(() => {
    reload();
    reloadTemas();
    reloadPlantilla();
    reloadObjetivos();
    reloadIncidencias();
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

  async function altaIncidencia(descripcion: string) {
    await api.addIncidencia(menteeId, descripcion);
    reloadIncidencias();
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

          <Incidencias incidencias={incidencias} onAdd={altaIncidencia} />

          <CambiosProyecto menteeId={menteeId} />

          <Traspasos menteeId={menteeId} manager={manager} onTraspasado={onBack} />

          <NuevoOneToOneForm
            menteeId={menteeId}
            temasGenericos={plantilla.filter((t) => t.estado === 'vigente').map((t) => t.tema)}
            temasPropios={temas}
            onSaved={reload}
          />

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

/** Formulario de registro de un 1-to-1: temas de la plantilla del manager + propios con nota por tema + acuerdos. */
function NuevoOneToOneForm({
  menteeId,
  temasGenericos,
  temasPropios,
  onSaved,
}: {
  menteeId: string;
  temasGenericos: string[];
  temasPropios: TemaPropio[];
  onSaved: () => void;
}) {
  const temas = [...temasGenericos, ...temasPropios.map((t) => t.tema)];
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

/** Incidencias de una mentee: historial (abiertas y resueltas) y alta. */
function Incidencias({
  incidencias,
  onAdd,
}: {
  incidencias: Incidencia[];
  onAdd: (descripcion: string) => Promise<void>;
}) {
  return (
    <section aria-label="Incidencias">
      <h2>Incidencias</h2>
      {incidencias.length === 0 ? (
        <p className="empty">Sin incidencias.</p>
      ) : (
        <ol className="historial">
          {incidencias.map((i) => (
            <li key={i.id}>
              <p className="objetivo-meta">
                {i.fechaAlta} · {i.estado === 'abierta' ? 'abierta' : `resuelta el ${i.fechaResolucion ?? ''}`}
              </p>
              <strong>{i.descripcion}</strong>
              {i.estado === 'resuelta' && <p className="objetivo-descripcion">{i.notaResolucion}</p>}
            </li>
          ))}
        </ol>
      )}
      <NuevaIncidenciaForm onAdd={onAdd} />
    </section>
  );
}

/** Formulario de alta de una incidencia abierta. */
function NuevaIncidenciaForm({ onAdd }: { onAdd: (descripcion: string) => Promise<void> }) {
  const [descripcion, setDescripcion] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onAdd(descripcion);
      setDescripcion('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Nueva incidencia">
      <label>
        Descripción
        <input
          type="text"
          value={descripcion}
          onChange={(e) => setDescripcion(e.target.value)}
          placeholder="p. ej. baja médica, conflicto, retraso…"
          required
        />
      </label>
      {error !== null && <p className="error">{error}</p>}
      <button type="submit">Registrar incidencia</button>
    </form>
  );
}

/** Historial de cambios de proyecto de una mentee y registro de un cambio nuevo. */
function CambiosProyecto({ menteeId }: { menteeId: string }) {
  const [situacion, setSituacion] = useState<SituacionProyecto | null>(null);
  const [catalogo, setCatalogo] = useState<Project[]>([]);

  function reload() {
    api.situacionProyecto(menteeId).then(setSituacion);
  }

  useEffect(() => {
    reload();
    api.proyectos().then(({ proyectos }) => setCatalogo(proyectos));
  }, [menteeId]);

  async function registrar(cambio: { fecha: string; destinoId: string | null; motivo: string }) {
    await api.registrarCambioProyecto(menteeId, cambio);
    reload();
  }

  return (
    <section aria-label="Cambios de proyecto">
      <h2>Cambios de proyecto</h2>
      {situacion === null ? (
        <p className="status">Cargando…</p>
      ) : (
        <>
          <p className="objetivo-meta">
            Proyecto actual: {situacion.project?.name ?? 'Sin proyecto'}
          </p>
          {situacion.cambios.length === 0 ? (
            <p className="empty">Sin cambios de proyecto registrados.</p>
          ) : (
            <ol className="historial">
              {situacion.cambios.map((c) => (
                <li key={c.id}>
                  <p className="objetivo-meta">
                    {c.fecha} · {nombreProyecto(catalogo, c.origenId)} → {nombreProyecto(catalogo, c.destinoId)}
                  </p>
                  <strong>{c.motivo}</strong>
                </li>
              ))}
            </ol>
          )}
          <NuevoCambioProyectoForm
            proyectoActual={situacion.project}
            catalogo={catalogo}
            onRegistrar={registrar}
          />
        </>
      )}
    </section>
  );
}

/** Resuelve el nombre legible de un proyecto a partir de su id (o "Sin proyecto"). */
function nombreProyecto(catalogo: Project[], id: string | null): string {
  if (id === null) return 'Sin proyecto';
  return catalogo.find((p) => p.id === id)?.name ?? id;
}

const SIN_PROYECTO = '__sin_proyecto__';

/** Formulario de registro de un cambio de proyecto: fecha, destino (origen derivado) y motivo. */
function NuevoCambioProyectoForm({
  proyectoActual,
  catalogo,
  onRegistrar,
}: {
  proyectoActual: Project | null;
  catalogo: Project[];
  onRegistrar: (cambio: { fecha: string; destinoId: string | null; motivo: string }) => Promise<void>;
}) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onRegistrar({
        fecha,
        destinoId: destino === SIN_PROYECTO ? null : destino,
        motivo,
      });
      setMotivo('');
      setDestino('');
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Registrar cambio de proyecto">
      <label>
        Fecha del cambio
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </label>
      <p className="objetivo-meta">Origen: {proyectoActual?.name ?? 'Sin proyecto'}</p>
      <label>
        Destino
        <select value={destino} onChange={(e) => setDestino(e.target.value)} required>
          <option value="" disabled>
            Selecciona destino
          </option>
          {proyectoActual !== null && <option value={SIN_PROYECTO}>Sin proyecto</option>}
          {catalogo
            .filter((p) => p.id !== proyectoActual?.id)
            .map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
        </select>
      </label>
      <label>
        Motivo
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          required
        />
      </label>
      {error !== null && <p className="error">{error}</p>}
      <button type="submit">Registrar cambio</button>
    </form>
  );
}

/** Traspaso de una mentee a otro manager: historial y alta con fecha, destino y motivo. */
function Traspasos({
  menteeId,
  manager,
  onTraspasado,
}: {
  menteeId: string;
  manager: Manager;
  onTraspasado: () => void;
}) {
  const [historial, setHistorial] = useState<Traspaso[] | null>(null);
  const [managers, setManagers] = useState<Manager[]>([]);

  function reload() {
    api.traspasosDe(menteeId).then(({ traspasos }) => setHistorial(traspasos));
  }

  useEffect(() => {
    reload();
    api.managers().then(({ managers: list }) => setManagers(list));
  }, [menteeId]);

  async function traspasar(destinoId: string, fecha: string, motivo: string) {
    await api.traspasar(menteeId, { fecha, destinoId, motivo });
    onTraspasado();
  }

  const nombre = (id: string) => managers.find((m) => m.id === id)?.name ?? id;

  return (
    <section aria-label="Traspaso">
      <h2>Traspaso</h2>
      {historial === null ? (
        <p className="status">Cargando…</p>
      ) : (
        <>
          {historial.length === 0 ? (
            <p className="empty">Sin traspasos registrados.</p>
          ) : (
            <ol className="historial">
              {historial.map((t) => (
                <li key={t.id}>
                  <p className="objetivo-meta">
                    {t.fecha} · {nombre(t.origenId)} → {nombre(t.destinoId)}
                  </p>
                  <strong>{t.motivo}</strong>
                </li>
              ))}
            </ol>
          )}
          <NuevoTraspasoForm
            managers={managers.filter((m) => m.id !== manager.id)}
            onTraspasar={traspasar}
          />
        </>
      )}
    </section>
  );
}

/** Formulario de traspaso: fecha, manager de destino y motivo. */
function NuevoTraspasoForm({
  managers,
  onTraspasar,
}: {
  managers: Manager[];
  onTraspasar: (destinoId: string, fecha: string, motivo: string) => Promise<void>;
}) {
  const [fecha, setFecha] = useState(() => new Date().toISOString().slice(0, 10));
  const [destino, setDestino] = useState('');
  const [motivo, setMotivo] = useState('');
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    try {
      await onTraspasar(destino, fecha, motivo);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Error inesperado');
    }
  }

  return (
    <form onSubmit={handleSubmit} aria-label="Registrar traspaso">
      <label>
        Fecha del traspaso
        <input type="date" value={fecha} onChange={(e) => setFecha(e.target.value)} required />
      </label>
      <label>
        Manager de destino
        <select value={destino} onChange={(e) => setDestino(e.target.value)} required>
          <option value="" disabled>
            Selecciona manager
          </option>
          {managers.map((m) => (
            <option key={m.id} value={m.id}>{m.name}</option>
          ))}
        </select>
      </label>
      <label>
        Motivo
        <input
          type="text"
          value={motivo}
          onChange={(e) => setMotivo(e.target.value)}
          required
        />
      </label>
      {error !== null && <p className="error">{error}</p>}
      <button type="submit">Traspasar</button>
    </form>
  );
}
