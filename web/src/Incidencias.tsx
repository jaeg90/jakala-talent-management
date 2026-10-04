import { useEffect, useId, useRef, useState } from 'react';
import { useOutletContext, useParams } from 'react-router';
import type { Incidencia } from './api';
import { api } from './api';
import { fechaConAnio, fechaExacta, fechaISO, fechaRelativa, hoyISO } from './lib/fechas';
import { DialogoConfirmacion } from './RegistrarUnoAUno';

/**
 * Incidencias de la ficha (spec §06) con los diálogos «Registrar incidencia»
 * (spec §12) y «Resolver incidencia»: grupos con contador, alta con fecha de
 * apertura elegida por el manager y resolución con nota obligatoria.
 */
export function Incidencias() {
  const { id } = useParams();
  // El punto terracota del sidebar vive en el ShellFicha: al registrar o resolver
  // se le pide que recuente las incidencias abiertas (contrato §06/§12). Se le
  // entrega la generación vigente de la ficha (`solicitud`) como token: si una
  // operación de la ficha anterior termina tras cambiar de mentee, el ShellFicha
  // descarta esa lectura atrasada y el punto no sobrescribe el de otra mentee.
  const { refrescarIncidencias, solicitud } = useOutletContext<{
    refrescarIncidencias: (solicitud?: number) => void;
    solicitud: number;
  }>();
  const [nombre, setNombre] = useState<string | null>(null);
  const [incidencias, setIncidencias] = useState<Incidencia[] | null>(null);
  const [error, setError] = useState(false);
  const [skeleton, setSkeleton] = useState(false);
  const solicitudRef = useRef(0);

  const [registrar, setRegistrar] = useState(false);
  const [resolver, setResolver] = useState<Incidencia | null>(null);
  const [aviso, setAviso] = useState<string | null>(null);

  // Destino de foco tras resolver (§06/§14): el siguiente «Resolver» de las
  // abiertas restantes o, si no quedan, «Registrar incidencia» de la cabecera.
  const registrarRef = useRef<HTMLButtonElement | null>(null);
  const resolverRefs = useRef<Record<string, HTMLButtonElement | null>>({});

  async function cargar(): Promise<void> {
    if (id === undefined) return;
    const solicitud = ++solicitudRef.current;
    setError(false);
    setIncidencias(null);
    setSkeleton(false);
    setAviso(null);
    // P4 (§Estados «Cargando»): skeleton solo si la carga tarda más de 300 ms.
    const inicio = Date.now();
    const reloj = window.setTimeout(() => {
      if (solicitud !== solicitudRef.current) return;
      if (Date.now() - inicio > 300) setSkeleton(true);
    }, 300);
    try {
      const [equipo, incidenciasResp] = await Promise.all([api.team(), api.incidenciasDe(id)]);
      if (solicitud !== solicitudRef.current) return;
      window.clearTimeout(reloj);
      setNombre(equipo.mentees.find((m) => m.id === id)?.name ?? '');
      setIncidencias(incidenciasResp.incidencias);
    } catch {
      if (solicitud !== solicitudRef.current) return;
      window.clearTimeout(reloj);
      setError(true);
    }
  }

  useEffect(() => {
    cargar();
  }, [id]);

  // Recarga las incidencias sin vaciar la lista (sin skeleton): la usan el alta y
  // la resolución, que cierran el diálogo en el propio diálogo y devuelven el foco
  // al disparador antes de desmontarse (accesibilidad.md §Diálogos: «foco vuelve al
  // disparador»). `cargar()` vacía y desmontaría el diálogo a mitad del guardado.
  // Recibe el token de generación capturado al INICIO de la operación que la
  // disparó: no incrementa `solicitudRef` (eso invalidaría la carga vigente de una
  // ficha nueva) y, si esa generación quedó atrás por un cambio de mentee, descarta
  // la lista atrasada en vez de sobrescribir la de la mentee nueva.
  async function recargar(generacion: number): Promise<void> {
    if (id === undefined) return;
    try {
      const incidenciasResp = await api.incidenciasDe(id);
      if (generacion !== solicitudRef.current) return;
      setIncidencias(incidenciasResp.incidencias);
    } catch {
      // La recarga es un refresco posterior a un guardado ya confirmado: un fallo
      // aquí NO debe reemplazar la pantalla (desmontaría el destino del foco del
      // patrón §06/§14). Se deja la lista tal cual y la próxima carga reintentará.
    }
  }

  async function guardarRegistro(descripcion: string, fechaApertura: string): Promise<void> {
    if (id === undefined) return;
    // Token de la generación vigente al INICIAR el alta: si cambiamos de mentee
    // mientras la petición está pendiente, la recarga posterior descarta su
    // respuesta atrasada en vez de pintar la lista de la ficha anterior.
    const generacion = solicitudRef.current;
    await api.addIncidencia(id, descripcion, fechaApertura);
    // El diálogo se cierra y devuelve el foco al disparador en su `cerrar()`; aquí
    // solo se recarga (sin vaciar) y se fija el aviso de éxito.
    await recargar(generacion);
    if (generacion !== solicitudRef.current) return;
    refrescarIncidencias(solicitud);
    setAviso('Incidencia registrada.');
  }

  async function confirmarResolucion(nota: string): Promise<void> {
    if (resolver === null) return;
    // Token de la generación vigente al INICIAR la resolución: si cambiamos de
    // mentee mientras la petición está pendiente, la recarga posterior descarta su
    // respuesta atrasada y no sobrescribe la lista (ni mueve el foco) de la ficha nueva.
    const generacion = solicitudRef.current;
    const idResuelta = resolver.id;
    // Siguiente «Resolver» de las abiertas restantes, calculado sobre la lista
    // previa (orden por fecha de apertura descendente). Al quitar la resuelta, el
    // destino en orden de lectura es la que ahora ocupa su posición; si era la
    // última, envuelve a la primera restante. Solo si no queda ninguna abierta el
    // foco va a «Registrar incidencia» (patrón §14, antidoto del foco perdido).
    const indice = abiertas.findIndex((i) => i.id === idResuelta);
    const restantes = abiertas.filter((i) => i.id !== idResuelta);
    const siguiente =
      restantes.length === 0
        ? undefined
        : indice >= 0 && indice < restantes.length
          ? restantes[indice]
          : restantes[0];
    await api.resolverIncidencia(idResuelta, nota);
    await recargar(generacion);
    if (generacion !== solicitudRef.current) return;
    refrescarIncidencias(solicitud);
    setResolver(null);
    // El foco al siguiente destino se aplica tras el re-render que desmonta la
    // resuelta: el elemento destino sigue en el DOM (la recarga no lo desmonta).
    // La generación ya se comprobó vigente en el `return` previo: los refs de
    // destino pertenecen a esta ficha y el foco salta al siguiente «Resolver».
    window.setTimeout(() => {
      if (siguiente !== undefined) resolverRefs.current[siguiente.id]?.focus();
      else registrarRef.current?.focus();
    }, 0);
  }

  if (error) {
    return (
      <section className="incidencias" aria-label="Incidencias">
        <Cabecera onRegistrar={() => setRegistrar(true)} disabled />
        <div className="estado" role="alert">
          <p className="estado__mensaje">No hemos podido cargar las incidencias. Revisa tu conexión.</p>
          <button className="boton boton--secundario" type="button" onClick={cargar}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (incidencias === null) {
    if (!skeleton) return null;
    return (
      <section className="incidencias" aria-label="Incidencias" aria-busy="true" data-testid="skeleton-incidencias">
        <Cabecera onRegistrar={() => setRegistrar(true)} disabled />
        <span className="sr-only">Cargando…</span>
        <div className="resumen-skeleton__cabecera" aria-hidden="true" />
        <div className="resumen-skeleton__tarjeta" aria-hidden="true" />
      </section>
    );
  }

  const abiertas = incidencias
    .filter((i) => i.estado === 'abierta')
    .sort((a, b) => b.fechaAlta.localeCompare(a.fechaAlta));
  const resueltas = incidencias
    .filter((i) => i.estado === 'resuelta')
    .sort((a, b) => (b.fechaResolucion ?? '').localeCompare(a.fechaResolucion ?? ''));

  return (
    <section className="incidencias" aria-label="Incidencias">
      <Cabecera onRegistrar={() => setRegistrar(true)} registrarRef={registrarRef} />

      {aviso !== null && (
        <div className="aviso aviso--exito" role="status">
          {aviso}
        </div>
      )}

      {incidencias.length === 0 ? (
        <div className="incidencias__vacio">
          <p className="incidencias__vacio-texto">
            Sin incidencias. Regístrala aquí si ocurre algo extraordinario (una baja, un
            conflicto, un retraso).
          </p>
        </div>
      ) : (
        <>
          <section className="incidencias__grupo" aria-label="Incidencias abiertas">
            <h2 className="incidencias__etiqueta">Abiertas · {abiertas.length}</h2>
            {abiertas.map((incidencia) => (
              <TarjetaAbierta
                key={incidencia.id}
                incidencia={incidencia}
                resolverRef={(el) => {
                  resolverRefs.current[incidencia.id] = el;
                }}
                onResolver={() => setResolver(incidencia)}
              />
            ))}
          </section>

          <section className="incidencias__grupo" aria-label="Incidencias resueltas">
            <h2 className="incidencias__etiqueta">Resueltas · {resueltas.length}</h2>
            {resueltas.map((incidencia) => (
              <TarjetaResuelta key={incidencia.id} incidencia={incidencia} />
            ))}
          </section>
        </>
      )}

      {registrar && (
        <DialogoRegistrar
          key="registrar"
          nombre={nombre ?? ''}
          onCerrar={() => setRegistrar(false)}
          onGuardar={guardarRegistro}
        />
      )}

      {resolver !== null && (
        <DialogoResolver
          key={resolver.id}
          incidencia={resolver}
          onCerrar={() => setResolver(null)}
          onConfirmar={confirmarResolucion}
        />
      )}
    </section>
  );
}

function Cabecera({
  onRegistrar,
  registrarRef,
  disabled = false,
}: {
  onRegistrar: () => void;
  registrarRef?: React.RefObject<HTMLButtonElement | null>;
  disabled?: boolean;
}) {
  return (
    <header className="ficha__cabecera">
      <div className="ficha__titulos">
        <h1>Incidencias</h1>
      </div>
      <button
        ref={registrarRef}
        className="boton boton--primario"
        type="button"
        onClick={onRegistrar}
        disabled={disabled}
      >
        Registrar incidencia
      </button>
    </header>
  );
}

/** Tarjeta de atención de una incidencia abierta (spec §06). */
function TarjetaAbierta({
  incidencia,
  resolverRef,
  onResolver,
}: {
  incidencia: Incidencia;
  resolverRef?: React.Ref<HTMLButtonElement>;
  onResolver: () => void;
}) {
  return (
    <article className="incidencia">
      <div className="incidencia__cuerpo">
        <div className="incidencia__fila">
          <span className="badge badge--abierta">Abierta</span>
          <span className="incidencia__descripcion">{incidencia.descripcion}</span>
        </div>
        <span className="incidencia__meta">
          Abierta el <time dateTime={fechaISO(incidencia.fechaAlta)}>{fechaExacta(incidencia.fechaAlta)}</time> ·{' '}
          <time dateTime={fechaISO(incidencia.fechaAlta)}>{fechaRelativa(incidencia.fechaAlta)}</time>
        </span>
      </div>
      <button
        ref={resolverRef}
        type="button"
        className="incidencia__resolver"
        aria-label={`Resolver: ${incidencia.descripcion}`}
        onClick={onResolver}
      >
        Resolver
      </button>
    </article>
  );
}

/** Tarjeta plana de una incidencia resuelta (spec §06). */
function TarjetaResuelta({ incidencia }: { incidencia: Incidencia }) {
  return (
    <article className="incidencia--plana">
      <div className="incidencia__fila">
        <span className="badge badge--resuelta">Resuelta</span>
        <span className="incidencia--plana__titulo">{incidencia.descripcion}</span>
      </div>
      <span className="incidencia__resolucion">
        <time dateTime={fechaISO(incidencia.fechaAlta)}>{fechaExacta(incidencia.fechaAlta)}</time>
        {' → '}
        <time dateTime={fechaISO(incidencia.fechaResolucion ?? incidencia.fechaAlta)}>
          {fechaExacta(incidencia.fechaResolucion ?? incidencia.fechaAlta)}
        </time>
        {' · «'}
        {incidencia.notaResolucion}
        {'»'}
      </span>
    </article>
  );
}

/** Diálogo «Registrar incidencia» (spec §12): descripción + fecha de apertura. */
function DialogoRegistrar({
  nombre,
  onCerrar,
  onGuardar,
}: {
  nombre: string;
  onCerrar: () => void;
  onGuardar: (descripcion: string, fechaApertura: string) => Promise<void>;
}) {
  const [descripcion, setDescripcion] = useState('');
  const [fechaApertura, setFechaApertura] = useState(() => hoyISO());
  const [errorDescripcion, setErrorDescripcion] = useState<string | null>(null);
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [errorGuardado, setErrorGuardado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [descartar, setDescartar] = useState(false);

  const ref = useRef<HTMLDialogElement>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);
  const descripcionRef = useRef<HTMLTextAreaElement>(null);
  const fechaRef = useRef<HTMLInputElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);

  const base = useId();
  const idTitulo = `${base}-titulo`;
  const idSubtitulo = `${base}-subtitulo`;
  const idErrorDescripcion = `${base}-error-descripcion`;
  const idFecha = `${base}-fecha`;
  const idAyudaFecha = `${base}-ayuda-fecha`;
  const idErrorFecha = `${base}-error-fecha`;

  // Abre el diálogo y recuerda el elemento disparador para devolverle el foco al
  // cerrar (accesibilidad.md §Diálogos: «foco vuelve al disparador»).
  useEffect(() => {
    disparadorRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
    cancelarRef.current?.focus();
  }, []);

  const dirty = descripcion.trim() !== '' || fechaApertura !== hoyISO();

  function validar(): boolean {
    let valido = true;
    if (descripcion.trim() === '') {
      setErrorDescripcion('Describe la incidencia.');
      valido = false;
    } else {
      setErrorDescripcion(null);
    }
    // El `input type="date"` admite quedarse vacío y `noValidate` desactiva el
    // `required` nativo: hay que comprobar la fecha antes de enviar o viajaría
    // `''` al servidor (que solo devolvería el error genérico de guardado).
    if (fechaApertura === '') {
      setErrorFecha('Elige una fecha.');
      valido = false;
    } else if (fechaApertura > hoyISO()) {
      setErrorFecha('La fecha no puede ser futura.');
      valido = false;
    } else {
      setErrorFecha(null);
    }
    if (!valido) {
      // Foco al primer campo inválido (orden del formulario: Descripción, Fecha).
      if (descripcion.trim() === '') descripcionRef.current?.focus();
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
      await onGuardar(descripcion.trim(), fechaApertura);
      cerrar();
    } catch {
      setEnviando(false);
      setErrorGuardado(true);
    }
  }

  // Cierra el `<dialog>` y devuelve el foco al disparador antes de desmontar
  // (accesibilidad.md §Diálogos: el retorno de foco no queda garantizado si el
  // diálogo se desmonta por estado sin `close()`).
  function cerrar() {
    const dialog = ref.current;
    if (dialog !== null && dialog.open) dialog.close();
    disparadorRef.current?.focus();
    onCerrar();
  }

  function pedirCerrar() {
    if (dirty) setDescartar(true);
    else cerrar();
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
            Registrar incidencia
          </h2>
          <p id={idSubtitulo} className="dialogo__subtitulo">
            {nombre} · algo extraordinario: una baja, un conflicto, un retraso.
          </p>
        </div>

        <form className="dialogo__formulario" onSubmit={manejarSubmit} noValidate>
          <label className="campo">
            <span>Descripción</span>
            <textarea
              ref={descripcionRef}
              className="incidencia__textarea"
              required
              value={descripcion}
              maxLength={500}
              placeholder="p. ej. Baja médica desde el lunes; vuelve previsiblemente el 6 oct"
              aria-invalid={errorDescripcion !== null}
              aria-describedby={errorDescripcion !== null ? idErrorDescripcion : undefined}
              onChange={(e) => {
                setDescripcion(e.target.value);
                setErrorDescripcion(null);
              }}
            />
            {errorDescripcion !== null && (
              <span className="campo__error" id={idErrorDescripcion}>
                {errorDescripcion}
              </span>
            )}
          </label>

          <div className="incidencia-dialogo__fecha">
            <label htmlFor={idFecha}>Fecha de apertura</label>
            <span className="campo-fecha">
              <input
                ref={fechaRef}
                id={idFecha}
                className="campo-fecha__input"
                type="date"
                required
                value={fechaApertura}
                max={hoyISO()}
                aria-invalid={errorFecha !== null}
                aria-describedby={`${idAyudaFecha}${errorFecha !== null ? ` ${idErrorFecha}` : ''}`}
                onChange={(e) => {
                  setFechaApertura(e.target.value);
                  setErrorFecha(null);
                }}
              />
              <span
                className={`campo-fecha__texto${errorFecha !== null ? ' campo-fecha__texto--error' : ''}`}
                aria-hidden="true"
              >
                {fechaApertura !== '' ? fechaConAnio(fechaApertura) : ''}
              </span>
            </span>
            <span className="campo-fecha__ayuda" id={idAyudaFecha}>
              Por defecto, hoy. Si empezó antes, elige ese día.
            </span>
            {errorFecha !== null && (
              <span className="campo__error" id={idErrorFecha}>
                {errorFecha}
              </span>
            )}
          </div>

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
              {enviando ? 'Registrando…' : 'Registrar incidencia'}
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
          cerrar();
        }}
      >
        <p>Lo que has escrito no se guardará.</p>
      </DialogoConfirmacion>
    </>
  );
}

/** Diálogo «Resolver incidencia» (spec §06): nota de resolución obligatoria. */
function DialogoResolver({
  incidencia,
  onCerrar,
  onConfirmar,
}: {
  incidencia: Incidencia;
  onCerrar: () => void;
  onConfirmar: (nota: string) => Promise<void>;
}) {
  const [nota, setNota] = useState('');
  const [errorGuardado, setErrorGuardado] = useState(false);
  const [enviando, setEnviando] = useState(false);
  const [descartar, setDescartar] = useState(false);

  const ref = useRef<HTMLDialogElement>(null);
  const disparadorRef = useRef<HTMLElement | null>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);

  const base = useId();
  const idTitulo = `${base}-titulo`;
  const idDescripcion = `${base}-descripcion`;

  // Abre el diálogo y recuerda el elemento disparador para devolverle el foco al
  // cerrar (accesibilidad.md §Diálogos: «foco vuelve al disparador»).
  useEffect(() => {
    disparadorRef.current =
      document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialog = ref.current;
    if (dialog !== null && !dialog.open) dialog.showModal();
    cancelarRef.current?.focus();
  }, []);

  // Con la nota escrita, Esc o «Cancelar» piden descartar antes de cerrar
  // (accesibilidad.md §Diálogos con formulario: «Esc cierra si no hay cambios, y
  // si los hay pide descartar»); con la nota vacía cierran directo.
  const dirty = nota.trim() !== '';

  // Cierra el `<dialog>` y devuelve el foco al disparador antes de desmontar
  // (accesibilidad.md §Diálogos: el retorno de foco no queda garantizado si el
  // diálogo se desmonta por estado sin `close()`).
  function cerrar() {
    const dialog = ref.current;
    if (dialog !== null && dialog.open) dialog.close();
    disparadorRef.current?.focus();
    onCerrar();
  }

  function pedirCerrar() {
    if (dirty) setDescartar(true);
    else cerrar();
  }

  async function manejarSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorGuardado(false);
    setEnviando(true);
    try {
      // `onConfirmar` (el padre) recarga la lista, cierra el diálogo y mueve el
      // foco al siguiente «Resolver» (o a «Registrar incidencia»). Aquí no hay
      // nada más que hacer: `cerrar()` enfocaría el disparador, que ya está fuera
      // del DOM tras mover la resuelta al grupo de resueltas.
      await onConfirmar(nota.trim());
    } catch {
      setEnviando(false);
      setErrorGuardado(true);
    }
  }

  return (
    <>
      <dialog
        ref={ref}
        className="dialogo dialogo--formulario"
        aria-labelledby={idTitulo}
        aria-describedby={idDescripcion}
        onCancel={(e) => {
          e.preventDefault();
          pedirCerrar();
        }}
      >
      <div className="dialogo__cabecera">
        <h2 id={idTitulo} className="dialogo__titulo">
          Resolver incidencia
        </h2>
        <p id={idDescripcion} className="dialogo__subtitulo">
          {incidencia.descripcion}
        </p>
      </div>

      <form className="dialogo__formulario" onSubmit={manejarSubmit} noValidate>
        <label className="campo">
          <span>Nota de resolución (obligatoria)</span>
          <textarea
            className="incidencia__textarea"
            value={nota}
            onChange={(e) => setNota(e.target.value)}
          />
        </label>

        <span className="incidencia__aviso">
          Una incidencia resuelta no se puede reabrir; quedará en el historial.
        </span>

        {errorGuardado && (
          <div className="aviso aviso--error" role="alert">
            No se ha podido guardar. Inténtalo de nuevo.
          </div>
        )}

        <div className="dialogo__acciones">
          <button ref={cancelarRef} className="boton boton--secundario" type="button" onClick={pedirCerrar}>
            Cancelar
          </button>
          <button
            className="boton boton--primario"
            type="submit"
            disabled={nota.trim() === '' || enviando}
          >
            {enviando ? 'Resolviendo…' : 'Resolver incidencia'}
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
          cerrar();
        }}
      >
        <p>Lo que has escrito no se guardará.</p>
      </DialogoConfirmacion>
    </>
  );
}
