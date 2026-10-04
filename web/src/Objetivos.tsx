import { useEffect, useId, useRef, useState } from 'react';
import { useParams, useSearchParams } from 'react-router';
import type { Objetivo, ObjetivoFields } from './api';
import { api } from './api';
import { fechaConAnio, fechaExacta, fechaISO, hoyISO, mesesHasta } from './lib/fechas';
import { DialogoConfirmacion } from './RegistrarUnoAUno';

/**
 * Objetivos de la ficha (spec §05) con los diálogos «Nuevo objetivo» / «Editar
 * objetivo» (spec §13): grupos con contador, cierre irreversible con confirmación,
 * alta y edición por diálogo con su contrato de accesibilidad.
 */

/** Estado del diálogo de alta/edición en la pantalla. */
type ModoDialogo =
  | { modo: 'cerrado' }
  | { modo: 'nuevo' }
  | { modo: 'editar'; objetivo: Objetivo };

/** Primer nombre de una persona («Ana Alonso» → «Ana»), para el vacío de §05. */
function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

export function Objetivos() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();

  const [nombre, setNombre] = useState<string | null>(null);
  const [objetivos, setObjetivos] = useState<Objetivo[] | null>(null);
  const [error, setError] = useState(false);
  const [skeleton, setSkeleton] = useState(false);
  const solicitudRef = useRef(0);

  const [dialogo, setDialogo] = useState<ModoDialogo>({ modo: 'cerrado' });
  const [aviso, setAviso] = useState<string | null>(null);
  const [aCerrar, setACerrar] = useState<{
    objetivo: Objetivo;
    estado: 'cumplido' | 'no cumplido';
  } | null>(null);
  const [cerrando, setCerrando] = useState(false);
  const [errorCierre, setErrorCierre] = useState(false);

  async function cargar(): Promise<void> {
    if (id === undefined) return;
    const solicitud = ++solicitudRef.current;
    setError(false);
    setObjetivos(null);
    setSkeleton(false);
    setAviso(null);
    setErrorCierre(false);
    // P4 (§Estados «Cargando»): skeleton solo si la carga tarda más de 300 ms.
    const inicio = Date.now();
    const reloj = window.setTimeout(() => {
      if (solicitud !== solicitudRef.current) return;
      if (Date.now() - inicio > 300) setSkeleton(true);
    }, 300);
    try {
      const [equipo, objetivosResp] = await Promise.all([api.team(), api.objetivos(id)]);
      if (solicitud !== solicitudRef.current) return;
      window.clearTimeout(reloj);
      setNombre(equipo.mentees.find((m) => m.id === id)?.name ?? '');
      setObjetivos(objetivosResp.objetivos);
    } catch {
      if (solicitud !== solicitudRef.current) return;
      window.clearTimeout(reloj);
      setError(true);
    }
  }

  useEffect(() => {
    cargar();
  }, [id]);

  // Desde el Resumen: «Nuevo objetivo» en el vacío de «Objetivos en curso» navega
  // a esta pantalla con `?nuevo=1`; se abre el diálogo al aterrizar y, al cerrar,
  // se queda en Objetivos (sin el parámetro).
  const desdeResumen = searchParams.get('nuevo') === '1';
  useEffect(() => {
    if (desdeResumen && objetivos !== null) {
      setDialogo({ modo: 'nuevo' });
      setSearchParams({}, { replace: true });
    }
  }, [desdeResumen, objetivos, setSearchParams]);

  async function guardar(fields: ObjetivoFields): Promise<void> {
    if (id === undefined) return;
    const esEdicion = dialogo.modo === 'editar';
    if (esEdicion) {
      await api.updateObjetivo(dialogo.objetivo.id, fields);
    } else {
      await api.addObjetivo(id, fields);
    }
    // Se cierra el diálogo y se recarga ANTES de fijar el aviso: `cargar()` pone
    // `aviso` a null, así que el aviso de éxito debe ir después de la recarga.
    setDialogo({ modo: 'cerrado' });
    await cargar();
    setAviso(esEdicion ? 'Objetivo actualizado.' : 'Objetivo creado.');
  }

  async function confirmarCierre() {
    if (aCerrar === null) return;
    const { objetivo, estado } = aCerrar;
    setCerrando(true);
    try {
      await api.cambiarEstadoObjetivo(objetivo.id, estado);
      cargar();
    } catch {
      setErrorCierre(true);
    } finally {
      setCerrando(false);
      setACerrar(null);
    }
  }

  if (error) {
    return (
      <section className="objetivos" aria-label="Objetivos">
        <Cabecera onNuevo={() => setDialogo({ modo: 'nuevo' })} />
        <div className="estado" role="alert">
          <p className="estado__mensaje">No hemos podido cargar los objetivos. Revisa tu conexión.</p>
          <button className="boton boton--secundario" type="button" onClick={cargar}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (objetivos === null) {
    if (!skeleton) return null;
    return (
      <section className="objetivos" aria-label="Objetivos" aria-busy="true" data-testid="skeleton-objetivos">
        <Cabecera onNuevo={() => setDialogo({ modo: 'nuevo' })} />
        <span className="sr-only">Cargando…</span>
        <div className="resumen-skeleton__cabecera" aria-hidden="true" />
        <div className="resumen-skeleton__tarjeta" aria-hidden="true" />
      </section>
    );
  }

  const enCurso = objetivos
    .filter((o) => o.estado === 'en curso')
    .sort((a, b) => a.fechaLimite.localeCompare(b.fechaLimite));
  const cumplidos = objetivos.filter((o) => o.estado === 'cumplido');
  const noCumplidos = objetivos.filter((o) => o.estado === 'no cumplido');

  return (
    <section className="objetivos" aria-label="Objetivos">
      <Cabecera onNuevo={() => setDialogo({ modo: 'nuevo' })} />

      {aviso !== null && (
        <div className="aviso aviso--exito" role="status">
          {aviso}
        </div>
      )}

      {errorCierre && (
        <div className="aviso aviso--error" role="alert">
          No se ha podido guardar. Inténtalo de nuevo.
        </div>
      )}

      {objetivos.length === 0 ? (
        <div className="objetivos__vacio">
          <p className="objetivos__vacio-texto">
            Aún no hay objetivos para {primerNombre(nombre ?? '')}. Define el primero para poder
            seguirlo en los 1-to-1s.
          </p>
          <button className="boton boton--secundario" type="button" onClick={() => setDialogo({ modo: 'nuevo' })}>
            Nuevo objetivo
          </button>
        </div>
      ) : (
        <>
          <Grupo
            etiqueta={`En curso · ${enCurso.length}`}
            ariaLabel="Objetivos en curso"
            vacio=""
            mostrarVacio={enCurso.length === 0}
          >
            {enCurso.map((o) => (
              <TarjetaEnCurso
                key={o.id}
                objetivo={o}
                onEditar={() => setDialogo({ modo: 'editar', objetivo: o })}
                onCerrar={(estado) => setACerrar({ objetivo: o, estado })}
              />
            ))}
          </Grupo>

          <Grupo
            etiqueta={`Cumplidos · ${cumplidos.length}`}
            ariaLabel="Objetivos cumplidos"
            vacio="Aún no hay objetivos cumplidos."
            mostrarVacio={cumplidos.length === 0}
          >
            {cumplidos.map((o) => (
              <TarjetaCerrado key={o.id} objetivo={o} />
            ))}
          </Grupo>

          <Grupo
            etiqueta={`No cumplidos · ${noCumplidos.length}`}
            ariaLabel="Objetivos no cumplidos"
            vacio="Ningún objetivo cerrado sin cumplir."
            mostrarVacio={noCumplidos.length === 0}
          >
            {noCumplidos.map((o) => (
              <TarjetaCerrado key={o.id} objetivo={o} />
            ))}
          </Grupo>
        </>
      )}

      {dialogo.modo !== 'cerrado' && (
        <DialogoObjetivo
          key={dialogo.modo === 'editar' ? dialogo.objetivo.id : 'nuevo'}
          modo={dialogo.modo === 'editar' ? 'editar' : 'nuevo'}
          nombre={nombre ?? ''}
          objetivo={dialogo.modo === 'editar' ? dialogo.objetivo : undefined}
          onCerrar={() => setDialogo({ modo: 'cerrado' })}
          onGuardar={guardar}
        />
      )}

      <DialogoConfirmacion
        abierto={aCerrar !== null}
        titulo={
          aCerrar === null
            ? ''
            : aCerrar.estado === 'cumplido'
              ? `¿Marcar «${aCerrar.objetivo.titulo}» como cumplido?`
              : `¿Marcar «${aCerrar.objetivo.titulo}» como no cumplido?`
        }
        cancelar="Cancelar"
        confirmar={aCerrar?.estado === 'cumplido' ? 'Marcar cumplido' : 'Marcar no cumplido'}
        confirmarDeshabilitado={cerrando}
        onCancelar={() => setACerrar(null)}
        onConfirmar={() => void confirmarCierre()}
      >
        No se puede reabrir.
      </DialogoConfirmacion>
    </section>
  );
}

function Cabecera({ onNuevo }: { onNuevo: () => void }) {
  return (
    <header className="ficha__cabecera">
      <div className="ficha__titulos">
        <h1>Objetivos</h1>
      </div>
      <button className="boton boton--primario" type="button" onClick={onNuevo}>
        Nuevo objetivo
      </button>
    </header>
  );
}

/** Grupo de objetivos (En curso / Cumplidos / No cumplidos) con su copia de vacío. */
function Grupo({
  etiqueta,
  ariaLabel,
  vacio,
  mostrarVacio,
  children,
}: {
  etiqueta: string;
  ariaLabel: string;
  vacio: string;
  mostrarVacio: boolean;
  children: React.ReactNode;
}) {
  return (
    <section className="objetivos__grupo" aria-label={ariaLabel}>
      <h2 className="objetivos__etiqueta">{etiqueta}</h2>
      {mostrarVacio ? (
        vacio !== '' ? (
          <p className="objetivos__grupo-vacio">{vacio}</p>
        ) : null
      ) : (
        children
      )}
    </section>
  );
}

/** Tarjeta de un objetivo en curso (spec §05): solo editable, con cierre y acciones. */
function TarjetaEnCurso({
  objetivo,
  onEditar,
  onCerrar,
}: {
  objetivo: Objetivo;
  onEditar: () => void;
  onCerrar: (estado: 'cumplido' | 'no cumplido') => void;
}) {
  const hoy = hoyISO();
  const meses = mesesHasta(objetivo.fechaLimite, hoy);
  // El aviso «· quedan n meses» — y su color de atención — solo existe mientras
  // la fecha límite es futura estricta (hoy < fecha límite): el día del límite o
  // una vez pasada, la línea queda «hasta {fecha}» plana (componentes.md §Fechas
  // veda «un contador a cero»).
  const mostrarQuedan = hoy < objetivo.fechaLimite && meses <= 3;
  return (
    <article className="objetivo">
      <span className="objetivo__titulo">{objetivo.titulo}</span>
      <span className="badge badge--en-curso objetivo__badge">En curso</span>
      <span className="objetivo__descripcion">{objetivo.descripcion}</span>
      {mostrarQuedan ? (
        <span className="objetivo__fecha objetivo__fecha--atencion">
          <time dateTime={fechaISO(objetivo.fechaLimite)}>
            hasta {fechaExacta(objetivo.fechaLimite)} · quedan {meses} meses
          </time>
        </span>
      ) : (
        <span className="objetivo__fecha">
          <time dateTime={fechaISO(objetivo.fechaLimite)}>hasta {fechaExacta(objetivo.fechaLimite)}</time>
        </span>
      )}
      <div className="objetivo__acciones">
        <button
          type="button"
          className="objetivo__accion objetivo__accion--cumplido"
          aria-label={`Marcar cumplido: ${objetivo.titulo}`}
          onClick={() => onCerrar('cumplido')}
        >
          Marcar cumplido
        </button>
        <button
          type="button"
          className="objetivo__accion objetivo__accion--no-cumplido"
          aria-label={`Marcar no cumplido: ${objetivo.titulo}`}
          onClick={() => onCerrar('no cumplido')}
        >
          Marcar no cumplido
        </button>
        <button
          type="button"
          className="objetivo__accion objetivo__accion--editar"
          aria-label={`Editar: ${objetivo.titulo}`}
          onClick={onEditar}
        >
          Editar
        </button>
      </div>
    </article>
  );
}

/** Tarjeta plana de un objetivo cerrado (cumplido / no cumplido), sin «Editar». */
function TarjetaCerrado({ objetivo }: { objetivo: Objetivo }) {
  const cumplido = objetivo.estado === 'cumplido';
  return (
    <article className="objetivo--plana">
      <span className="objetivo--plana__titulo">{objetivo.titulo}</span>
      <span className={`badge ${cumplido ? 'badge--cumplido' : 'badge--no-cumplido'} objetivo__badge`}>
        {cumplido ? 'Cumplido' : 'No cumplido'} ·{' '}
        <time dateTime={fechaISO(objetivo.fechaLimite)}>{fechaExacta(objetivo.fechaLimite)}</time>
      </span>
    </article>
  );
}

/** Diálogo `<dialog>` modal de alta/edición de objetivo (spec §13 + accesibilidad.md
 *  §Diálogos con formulario): foco inicial en «Cancelar», Esc pide descartar con
 *  cambios, errores por campo y guardado en `role="alert"` conservando lo escrito. */
function DialogoObjetivo({
  modo,
  nombre,
  objetivo,
  onCerrar,
  onGuardar,
}: {
  modo: 'nuevo' | 'editar';
  nombre: string;
  objetivo?: Objetivo;
  onCerrar: () => void;
  onGuardar: (fields: ObjetivoFields) => Promise<void>;
}) {
  const [titulo, setTitulo] = useState(objetivo?.titulo ?? '');
  const [descripcion, setDescripcion] = useState(objetivo?.descripcion ?? '');
  const [fechaLimite, setFechaLimite] = useState(objetivo?.fechaLimite ?? '');
  const [errorTitulo, setErrorTitulo] = useState<string | null>(null);
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [errorGuardado, setErrorGuardado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [descartar, setDescartar] = useState(false);

  const ref = useRef<HTMLDialogElement>(null);
  const tituloRef = useRef<HTMLInputElement>(null);
  const fechaRef = useRef<HTMLInputElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);

  const base = useId();
  const idTitulo = `${base}-titulo`;
  const idSubtitulo = `${base}-subtitulo`;
  const idErrorTitulo = `${base}-error-titulo`;
  const idErrorFecha = `${base}-error-fecha`;

  // Foco inicial en «Cancelar» (contrato del paquete).
  useEffect(() => {
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
    cancelarRef.current?.focus();
  }, []);

  const dirty =
    modo === 'editar'
      ? titulo !== (objetivo?.titulo ?? '') ||
        descripcion !== (objetivo?.descripcion ?? '') ||
        fechaLimite !== (objetivo?.fechaLimite ?? '')
      : titulo.trim() !== '' || descripcion !== '' || fechaLimite !== '';

  function validar(): boolean {
    let valido = true;
    if (titulo.trim() === '') {
      setErrorTitulo('Ponle un título al objetivo.');
      valido = false;
    } else {
      setErrorTitulo(null);
    }
    if (fechaLimite === '') {
      setErrorFecha('Elige una fecha límite.');
      valido = false;
    } else if (fechaLimite < hoyISO()) {
      setErrorFecha('La fecha límite no puede estar en el pasado.');
      valido = false;
    } else {
      setErrorFecha(null);
    }
    if (!valido) {
      // Foco al primer campo inválido (orden del formulario: Título, luego Fecha).
      if (titulo.trim() === '') tituloRef.current?.focus();
      else fechaRef.current?.focus();
    }
    return valido;
  }

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorGuardado(false);
    if (!validar()) return;
    setEnviando(true);
    try {
      await onGuardar({ titulo: titulo.trim(), descripcion, fechaLimite });
    } catch {
      setEnviando(false);
      setErrorGuardado(true);
    }
  }

  function pedirCerrar() {
    if (dirty) setDescartar(true);
    else onCerrar();
  }

  return (
    <>
      <dialog
        ref={ref}
        className="dialogo dialogo--formulario"
        aria-labelledby={idTitulo}
        aria-describedby={idSubtitulo}
        onCancel={(e) => {
          e.preventDefault();
          pedirCerrar();
        }}
      >
        <div className="dialogo__cabecera">
          <h2 id={idTitulo} className="dialogo__titulo">
            {modo === 'nuevo' ? 'Nuevo objetivo' : 'Editar objetivo'}
          </h2>
          <p id={idSubtitulo} className="dialogo__subtitulo">
            {modo === 'nuevo'
              ? `Para ${nombre}. Lo seguiréis en los 1-to-1s hasta que lo marques cumplido o no cumplido.`
              : 'Solo los objetivos en curso se pueden editar.'}
          </p>
        </div>

        <form className="dialogo__formulario" onSubmit={manejarSubmit} noValidate>
          <label className="campo">
            <span>Título</span>
            <input
              ref={tituloRef}
              type="text"
              required
              value={titulo}
              maxLength={120}
              aria-invalid={errorTitulo !== null}
              aria-describedby={errorTitulo !== null ? idErrorTitulo : undefined}
              onChange={(e) => {
                setTitulo(e.target.value);
                setErrorTitulo(null);
              }}
            />
            {errorTitulo !== null && (
              <span className="campo__error" id={idErrorTitulo}>
                {errorTitulo}
              </span>
            )}
          </label>

          <label className="campo">
            <span>Descripción (opcional)</span>
            <textarea
              value={descripcion}
              maxLength={500}
              onChange={(e) => setDescripcion(e.target.value)}
            />
          </label>

          <label className="objetivo-dialogo__fecha">
            <span>Fecha límite</span>
            <span className="campo-fecha">
              <input
                ref={fechaRef}
                className="campo-fecha__input"
                type="date"
                required
                value={fechaLimite}
                min={hoyISO()}
                aria-invalid={errorFecha !== null}
                aria-describedby={errorFecha !== null ? idErrorFecha : undefined}
                onChange={(e) => {
                  setFechaLimite(e.target.value);
                  setErrorFecha(null);
                }}
              />
              <span
                className={`campo-fecha__texto${errorFecha !== null ? ' campo-fecha__texto--error' : ''}`}
                aria-hidden="true"
              >
                {fechaLimite !== '' ? fechaConAnio(fechaLimite) : ''}
              </span>
            </span>
            {errorFecha !== null && (
              <span className="campo__error" id={idErrorFecha}>
                {errorFecha}
              </span>
            )}
          </label>

          {errorGuardado && (
            <div className="aviso aviso--error" role="alert">
              No se ha podido guardar. Inténtalo de nuevo.
            </div>
          )}

          <div className="dialogo__acciones">
            <button ref={cancelarRef} className="boton boton--secundario" type="button" onClick={pedirCerrar}>
              Cancelar
            </button>
            <button className="boton boton--primario" type="submit" disabled={enviando}>
              {modo === 'nuevo'
                ? enviando
                  ? 'Creando…'
                  : 'Crear objetivo'
                : enviando
                  ? 'Guardando…'
                  : 'Guardar cambios'}
            </button>
          </div>
        </form>
      </dialog>

      <DialogoConfirmacion
        abierto={descartar}
        titulo="¿Descartar los cambios?"
        cancelar="Seguir editando"
        confirmar="Descartar cambios"
        onCancelar={() => setDescartar(false)}
        onConfirmar={() => {
          setDescartar(false);
          onCerrar();
        }}
      >
        <p>Lo que has escrito no se guardará.</p>
      </DialogoConfirmacion>
    </>
  );
}