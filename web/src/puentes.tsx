import { useEffect, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import type {
  Incidencia,
  Manager,
  ManagerAutenticado,
  OneToOne,
  Project,
  SituacionProyecto,
  TemaPropio,
  Traspaso,
} from './api';
import { api } from './api';
import { useAuth } from './auth';

/**
 * Puentes temporales (ADR-0011): las secciones de la ficha que aún no tienen
 * pantalla Lino se montan en sus rutas futuras dentro del shell. Cada puente
 * muere en su ticket (objetivos #21, incidencias #22, temas propios #32, etc.).
 */

/** Lista temporal de 1-to-1s (puente; la pantalla §10 llega con su ticket). */
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

/** Incidencias de una mentee (puente; la pantalla §06 llega con #22). */
export function PuenteIncidencias() {
  const { id } = useParams();
  const [incidencias, setIncidencias] = useState<Incidencia[] | null>(null);

  function reload() {
    if (id === undefined) return;
    api.incidenciasDe(id).then(({ incidencias: list }) => setIncidencias(list));
  }

  useEffect(() => {
    reload();
  }, [id]);

  return (
    <div className="puente">
      <header className="ficha__cabecera">
        <h1>Incidencias</h1>
      </header>
      {incidencias === null ? (
        <p className="status">Cargando…</p>
      ) : (
        <Incidencias
          incidencias={incidencias}
          onAdd={async (descripcion) => {
            if (id === undefined) return;
            await api.addIncidencia(id, descripcion);
            reload();
          }}
        />
      )}
    </div>
  );
}

/** Ajustes de la mentee (puente: temas propios, proyectos y traspaso; las pantallas §08 llegan con sus tickets). */
export function PuenteAjustes() {
  const { id } = useParams();
  const { manager } = useAuth();
  const navigate = useNavigate();
  const [temas, setTemas] = useState<TemaPropio[] | null>(null);

  function reloadTemas() {
    if (id === undefined) return;
    api.temasPropios(id).then(({ temas: t }) => setTemas(t.filter((x) => x.estado === 'vigente')));
  }

  useEffect(() => {
    reloadTemas();
  }, [id]);

  if (manager === null) return null;

  return (
    <div className="puente">
      <header className="ficha__cabecera">
        <h1>Ajustes de la mentee</h1>
      </header>
      {temas === null ? (
        <p className="status">Cargando…</p>
      ) : (
        <TemasPropios
          temas={temas}
          onAlta={async (nombre) => {
            if (id === undefined) return;
            await api.addTemaPropio(id, nombre);
            reloadTemas();
          }}
          onBaja={async (temaPropioId) => {
            if (id === undefined) return;
            await api.retirarTemaPropio(id, temaPropioId);
            reloadTemas();
          }}
        />
      )}
      {id !== undefined && <CambiosProyecto menteeId={id} />}
      {id !== undefined && <Traspasos menteeId={id} manager={manager} onTraspasado={() => navigate('/equipo')} />}
    </div>
  );
}

/** Alta y baja de temas propios de una mentee (legacy; muere en #32). */
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
  manager: ManagerAutenticado;
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