import { useEffect, useMemo, useRef, useState } from 'react';
import { Link, useBlocker, useNavigate, useParams } from 'react-router';
import type {
  AcuerdoView,
  Incidencia,
  Objetivo,
  OneToOne,
  TemaPlantilla,
  TemaPropio,
} from './api';
import { api } from './api';
import { fechaCorta, fechaConAnio, fechaISO, fechaRelativa } from './lib/fechas';

/**
 * Registrar 1-to-1 (spec §04): pantalla completa, sin sidebar. Barra superior con
 * «← {nombre}», fecha (chip), estado del borrador, «Descartar» y «Guardar 1-to-1»;
 * cuerpo en grid `1fr 320px` con las tres tarjetas numeradas y la columna de
 * contexto. Persiste `registradoPor`/`registradoEn` (base del plazo de #35).
 */

/** Hoy en ISO (YYYY-MM-DD), la misma convención UTC del backend (`hoyISO`). */
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}

/** Un tema del formulario: genérico (plantilla) o propio, con su clave estable. */
interface TemaForm {
  clave: string;
  tipo: 'generico' | 'propio';
  pregunta: string;
  /** Id del tema propio (solo para propios; para la retirada real). */
  temaPropioId?: string;
}

/** Primer nombre de una persona («Ana Alonso» → «Ana»), para el copy del contexto. */
function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

/** Primera nota no vacía de un 1-to-1 (spec §03 cita, reutilizada en el contexto). */
function primeraNota(notas: OneToOne['notas']): string | null {
  for (const n of notas) {
    if (n.nota.trim() !== '') return n.nota;
  }
  return null;
}

/**
 * Sigue una media query de ancho de viewport y reacciona a sus cambios. Se usa
 * para elegir entre la columna fija (escritorio) y el desplegable (móvil) del
 * contexto de Registrar 1-to-1; el CSS solo no puede quitarle al `summary` su
 * operabilidad por teclado.
 */
function useMediaQuery(query: string): boolean {
  const [coincide, setCoincide] = useState(() => window.matchMedia(query).matches);
  useEffect(() => {
    const media = window.matchMedia(query);
    const alCambiar = () => setCoincide(media.matches);
    media.addEventListener('change', alCambiar);
    return () => media.removeEventListener('change', alCambiar);
  }, [query]);
  return coincide;
}

export function RegistrarUnoAUno() {
  const { id } = useParams();
  const navigate = useNavigate();

  // — Datos de contexto y del formulario —
  const [nombre, setNombre] = useState<string | null>(null);
  const [plantilla, setPlantilla] = useState<TemaPlantilla[] | null>(null);
  const [temasPropios, setTemasPropios] = useState<TemaPropio[] | null>(null);
  const [ultimo, setUltimo] = useState<OneToOne | null>(null);
  const [objetivos, setObjetivos] = useState<Objetivo[] | null>(null);
  const [incidencias, setIncidencias] = useState<Incidencia[] | null>(null);
  const [errorCarga, setErrorCarga] = useState(false);
  const [skeleton, setSkeleton] = useState(false);

  // — Edición del borrador —
  const [fecha, setFecha] = useState(hoyISO);
  const [notas, setNotas] = useState<Record<string, string>>({});
  const [acuerdosNuevos, setAcuerdosNuevos] = useState<string[]>([]);
  const [nuevoAcuerdo, setNuevoAcuerdo] = useState('');
  const [cumplidos, setCumplidos] = useState<ReadonlySet<string>>(new Set());
  const [retirados, setRetirados] = useState<ReadonlySet<string>>(new Set());
  const [anuncio, setAnuncio] = useState('');
  // Anuncio de retirada de tema propio (§14: «Tema «…» retirado.»), en región
  // `aria-live="polite"` estable (a diferencia de «Cumplido», que vive en la tarjeta 1).
  const [anuncioRetirada, setAnuncioRetirada] = useState('');

  // — Alta inline de tema propio —
  const [altaTemaAbierta, setAltaTemaAbierta] = useState(false);
  const [nuevoTemaPropio, setNuevoTemaPropio] = useState('');
  const [errorAlta, setErrorAlta] = useState<string | null>(null);

  // — Diálogos y estado de guardado —
  const [temaARetirar, setTemaARetirar] = useState<TemaForm | null>(null);
  const [descartarManual, setDescartarManual] = useState(false);
  const [errorValidacion, setErrorValidacion] = useState<string | null>(null);
  // Error específico del campo de fecha (vacío o futura). Vive aparte de
  // `errorValidacion` para marcar el `input type="date"` con `aria-invalid` y
  // `aria-describedby` al mensaje (accesibilidad.md §Campos).
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [errorGuardado, setErrorGuardado] = useState(false);
  const [guardando, setGuardando] = useState(false);

  // Estados P4 de envío de «añadir» y «retirar» tema (spec §14: gerundio + deshabilitado).
  const [retirando, setRetirando] = useState(false);
  const [añadiendo, setAñadiendo] = useState(false);
  // Contexto desplegable en móvil: abierto por defecto. En escritorio el contexto
  // es una columna fija (no colapsable) y este estado no se usa.
  const [contextoAbierto, setContextoAbierto] = useState(true);
  // En móvil (< 640px, decisiones.md §Responsive) el contexto es un desplegable
  // (`details`); en escritorio es una columna fija no colapsable. Renderar un
  // `details` siempre abierto con `pointer-events: none` no basta: `summary` sigue
  // siendo operable por teclado y cerraría el panel en escritorio. Por eso se elige
  // el elemento en función del ancho real del viewport (no del CSS).
  const esMovil = useMediaQuery('(max-width: 639px)');

  const requestRef = useRef(0);

  // Foco post-retirada (accesibilidad.md §27/§49): tras retirar un tema propio, el
  // foco va al botón «Retirar» del siguiente tema propio o, si no quedan, al campo
  // de alta. Refs: un botón «Retirar» por clave y el campo de alta (input o «+ Añadir»).
  const retirarRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const campoAltaRef = useRef<HTMLElement | null>(null);

  function cargar() {
    if (id === undefined) return;
    const request = ++requestRef.current;
    setErrorCarga(false);
    setSkeleton(false);
    const inicio = Date.now();
    const reloj = window.setTimeout(() => {
      if (request !== requestRef.current) return;
      if (Date.now() - inicio > 300) setSkeleton(true);
    }, 300);
    Promise.all([
      api.team(),
      api.plantilla(),
      api.temasPropios(id),
      api.ficha(id),
      api.objetivos(id),
      api.incidenciasDe(id),
    ])
      .then(([equipo, plantillaResp, temasResp, fichaResp, objetivosResp, incidenciasResp]) => {
        if (request !== requestRef.current) return;
        window.clearTimeout(reloj);
        setNombre(equipo.mentees.find((m) => m.id === id)?.name ?? '');
        setPlantilla(
          plantillaResp.temas
            .filter((t) => t.estado === 'vigente')
            .sort((a, b) => a.orden - b.orden),
        );
        setTemasPropios(temasResp.temas.filter((t) => t.estado === 'vigente'));
        // El último 1-to-1 cronológico alimenta la tarjeta 1 y la columna de contexto.
        setUltimo(fichaResp.history[fichaResp.history.length - 1] ?? null);
        setObjetivos(objetivosResp.objetivos);
        setIncidencias(incidenciasResp.incidencias);
      })
      .catch(() => {
        if (request !== requestRef.current) return;
        window.clearTimeout(reloj);
        setErrorCarga(true);
      });
  }

  useEffect(() => {
    cargar();
  }, [id]);

  // Temas del formulario: genéricos de la plantilla (en su orden) + propios vigentes.
  const temas: TemaForm[] = useMemo(() => {
    const lista: TemaForm[] = [];
    for (const t of plantilla ?? []) {
      lista.push({ clave: `plantilla:${t.id}`, tipo: 'generico', pregunta: t.tema });
    }
    for (const t of temasPropios ?? []) {
      if (!retirados.has(t.id)) {
        lista.push({ clave: `propio:${t.id}`, tipo: 'propio', pregunta: t.tema, temaPropioId: t.id });
      }
    }
    return lista;
  }, [plantilla, temasPropios, retirados]);

  // ¿Hay cambios sin guardar? Cualquiera de: una nota no vacía de un tema que sigue
  // en el formulario, un acuerdo añadido, texto sin añadir en el campo de acuerdo o en
  // el de «Nuevo tema propio», o una fecha distinta de la de hoy. Las notas de temas
  // retirados se excluyen: retirar un tema descarta su texto, y una salida posterior
  // no debe pedir confirmación por un borrador que ya se perdió.
  const dirty = useMemo(() => {
    const clavesActivas = new Set(temas.map((t) => t.clave));
    const hayNota = Object.entries(notas).some(
      ([clave, n]) => clavesActivas.has(clave) && n.trim() !== '',
    );
    return (
      hayNota ||
      acuerdosNuevos.length > 0 ||
      nuevoAcuerdo.trim() !== '' ||
      nuevoTemaPropio.trim() !== '' ||
      fecha !== hoyISO()
    );
  }, [temas, notas, acuerdosNuevos, nuevoAcuerdo, nuevoTemaPropio, fecha]);

  // — Bloqueo de salida con borrador sin guardar (navegación in-app e historial) —
  const saltarBloqueo = useRef(false);
  const bloqueador = useBlocker(
    ({ currentLocation, nextLocation }) =>
      !saltarBloqueo.current && dirty && currentLocation.pathname !== nextLocation.pathname,
  );
  const mostrarDescartar = descartarManual || bloqueador.state === 'blocked';

  // — Recarga del navegador con borrador sin guardar (beforeunload) —
  useEffect(() => {
    if (!dirty) return;
    const avisar = (e: BeforeUnloadEvent) => {
      // `beforeunload` solo puede mostrar el aviso nativo del navegador (no el
      // `alertdialog`); `preventDefault` y `returnValue` lo disparan en los
      // navegadores actuales.
      e.preventDefault();
      e.returnValue = '';
    };
    window.addEventListener('beforeunload', avisar);
    return () => window.removeEventListener('beforeunload', avisar);
  }, [dirty]);

  // — Acciones —
  function marcarCumplido(acuerdo: AcuerdoView) {
    setErrorGuardado(false);
    api
      .completeAgreement(acuerdo.id)
      .then(() => {
        setAnuncio('Cumplido');
        setCumplidos((actual) => new Set(actual).add(acuerdo.id));
      })
      .catch(() => setErrorGuardado(true));
  }

  async function confirmarRetirada() {
    if (temaARetirar === null || temaARetirar.temaPropioId === undefined || id === undefined) return;
    const temaId = temaARetirar.temaPropioId;
    const claveRetirada = temaARetirar.clave;
    const nombreRetirado = temaARetirar.pregunta;
    setRetirando(true);
    setErrorGuardado(false);
    try {
      // Retirada real (no un cambio local del borrador): el copy de §14 promete que
      // dejará de aparecer en los próximos 1-to-1s; los ya registrados no cambian.
      await api.retirarTemaPropio(id, temaId);
      setRetirados((actual) => new Set(actual).add(temaId));
      setTemaARetirar(null);
      setAnuncioRetirada(`Tema «${nombreRetirado}» retirado.`);
      // Foco al siguiente «Retirar» (o al campo de alta), tras el re-render que
      // desmonta el tema retirado (accesibilidad.md §27/§49).
      const indice = temas.findIndex((t) => t.clave === claveRetirada);
      const siguiente = temas.find((t, i) => t.tipo === 'propio' && i > indice);
      window.setTimeout(() => {
        if (siguiente !== undefined) {
          retirarRefs.current[siguiente.clave]?.focus();
        } else {
          campoAltaRef.current?.focus();
        }
      }, 0);
    } catch {
      setErrorGuardado(true);
    } finally {
      setRetirando(false);
    }
  }

  async function añadirTemaPropio() {
    if (id === undefined) return;
    const nombreTema = nuevoTemaPropio.trim();
    if (nombreTema === '') {
      setErrorAlta('Escribe el tema.');
      return;
    }
    setErrorAlta(null);
    setAñadiendo(true);
    try {
      const creado = await api.addTemaPropio(id, nombreTema);
      setTemasPropios((actual) => [...(actual ?? []), creado]);
      setNuevoTemaPropio('');
      setAltaTemaAbierta(false);
    } catch (err) {
      setErrorAlta(err instanceof Error ? err.message : 'No se ha podido guardar. Inténtalo de nuevo.');
    } finally {
      setAñadiendo(false);
    }
  }

  function añadirAcuerdo() {
    const texto = nuevoAcuerdo.trim();
    if (texto === '') return;
    setAcuerdosNuevos((actual) => [...actual, texto]);
    setNuevoAcuerdo('');
    setErrorValidacion(null);
  }

  async function guardar() {
    if (id === undefined) return;
    setErrorValidacion(null);
    setErrorFecha(null);
    setErrorGuardado(false);
    // La fecha debe estar presente (el `input type="date"` permite quedarse vacío):
    // sin ella se persistiría `date: ""`, que no es la fecha ISO del modelo.
    if (fecha === '') {
      const mensaje = 'Elige una fecha.';
      setErrorFecha(mensaje);
      setErrorValidacion(mensaje);
      return;
    }
    if (fecha > hoyISO()) {
      const mensaje = 'La fecha no puede ser futura.';
      setErrorFecha(mensaje);
      setErrorValidacion(mensaje);
      return;
    }
    // La validación mira el contenido guardable (notas o acuerdos añadidos), no el
    // flag `dirty`: cambiar solo la fecha o escribir en el campo de acuerdo sin
    // pulsar «Añadir acuerdo» no debe permitir guardar un 1-to-1 vacío.
    const notasAGuardar = temas
      .map((t) => ({ tema: t.pregunta, nota: notas[t.clave] ?? '' }))
      .filter((n) => n.nota.trim() !== '');
    const acuerdosAGuardar = acuerdosNuevos.map((text) => ({ text }));
    if (notasAGuardar.length === 0 && acuerdosAGuardar.length === 0) {
      setErrorValidacion('Escribe al menos una nota o un acuerdo antes de guardar.');
      return;
    }
    setGuardando(true);
    try {
      await api.saveOneToOne(id, { date: fecha, notas: notasAGuardar, acuerdos: acuerdosAGuardar });
      saltarBloqueo.current = true;
      navigate(`/mentees/${id}?guardado=${fecha}`, { replace: true });
    } catch {
      setGuardando(false);
      setErrorGuardado(true);
    }
  }

  function confirmarDescartar() {
    setDescartarManual(false);
    if (bloqueador.state === 'blocked') {
      bloqueador.proceed();
    } else {
      saltarBloqueo.current = true;
      navigate(`/mentees/${id}`);
    }
  }

  function cancelarDescartar() {
    if (bloqueador.state === 'blocked') bloqueador.reset();
    setDescartarManual(false);
  }

  function descartarBoton() {
    if (!dirty) {
      saltarBloqueo.current = true;
      navigate(`/mentees/${id}`);
      return;
    }
    setDescartarManual(true);
  }

  // — Estados P4 —
  if (errorCarga) {
    return (
      <main className="registro-1to1">
        <div className="estado" role="alert">
          <p className="estado__mensaje">No hemos podido cargar el formulario. Revisa tu conexión.</p>
          <button className="boton boton--secundario" type="button" onClick={cargar}>
            Reintentar
          </button>
        </div>
      </main>
    );
  }

  if (
    nombre === null ||
    plantilla === null ||
    temasPropios === null ||
    objetivos === null ||
    incidencias === null
  ) {
    if (!skeleton) {
      return <main className="registro-1to1" aria-busy="true" />;
    }
    return (
      <main className="registro-1to1" aria-busy="true">
        <span className="sr-only">Cargando…</span>
        <div className="registro-1to1__skeleton-barra" aria-hidden="true" />
        <div className="registro-1to1__skeleton-cuerpo" aria-hidden="true">
          <div className="registro-1to1__skeleton-principal">
            <div className="registro-1to1__skeleton-tarjeta" />
            <div className="registro-1to1__skeleton-tarjeta" />
            <div className="registro-1to1__skeleton-tarjeta" />
          </div>
          <div className="registro-1to1__skeleton-contexto" />
        </div>
      </main>
    );
  }

  const acuerdosUltimo = ultimo?.acuerdos ?? [];
  const pendientesUltimo = acuerdosUltimo.filter((a) => !a.done && !cumplidos.has(a.id));
  const cumplidosUltimo = acuerdosUltimo.filter((a) => a.done || cumplidos.has(a.id));
  const incidenciasAbiertas = incidencias.filter((i) => i.estado === 'abierta');
  const objetivosEnCurso = objetivos.filter((o) => o.estado === 'en curso');
  const cita = ultimo !== null ? primeraNota(ultimo.notas) : null;

  const contextoContenido = (
    <>
      {ultimo !== null && (
        <section className="registro-1to1__bloque" aria-label="Último 1-to-1">
          <h3 className="registro-1to1__etiqueta-contexto">
            Del último 1-to-1 ·{' '}
            <time dateTime={fechaISO(ultimo.date)}>{fechaCorta(ultimo.date)}</time>
          </h3>
          {cita !== null && <p className="registro-1to1__cita">«{cita}»</p>}
        </section>
      )}

      <section className="registro-1to1__bloque" aria-label="Objetivos en curso">
        <h3 className="registro-1to1__etiqueta-contexto">Objetivos en curso</h3>
        {objetivosEnCurso.length === 0 ? (
          <>
            <p className="registro-1to1__vacio">
              Sin objetivos en curso. Define uno para poder seguirlo en los 1-to-1s.
            </p>
            <Link className="accion" to={`/mentees/${id}/objetivos?nuevo=1`}>
              Nuevo objetivo
            </Link>
          </>
        ) : (
          <ul className="registro-1to1__lista-contexto">
            {objetivosEnCurso.map((o) => (
              <li key={o.id}>{o.titulo}</li>
            ))}
          </ul>
        )}
      </section>

      {incidenciasAbiertas.length > 0 && (
        <section className="tarjeta tarjeta--atencion" aria-label="Incidencia abierta">
          <h3 className="registro-1to1__titulo-atencion">
            {incidenciasAbiertas.length === 1
              ? '1 incidencia abierta'
              : `${incidenciasAbiertas.length} incidencias abiertas`}
          </h3>
          {incidenciasAbiertas.map((i) => (
            <div key={i.id}>
              <p className="registro-1to1__incidencia">{i.descripcion}</p>
              <time className="registro-1to1__incidencia-fecha" dateTime={i.fechaAlta}>
                {fechaRelativa(i.fechaAlta)}
              </time>
            </div>
          ))}
        </section>
      )}
    </>
  );

  return (
    <main className="registro-1to1">
      {/* Anuncio de retirada de tema propio (§14: «Tema «…» retirado.»), región
         aria-live="polite" estable, fuera de la región «Temas» para no teñir sus
         aserciones con el nombre del tema retirado. */}
      <span className="sr-only" aria-live="polite">
        {anuncioRetirada}
      </span>
      {/* Anuncio «Cumplido» en una región `role="status"` estable (accesibilidad.md
         §Checkbox de acuerdo): la tarjeta 1 se desmonta al cumplir el último
         pendiente, y el anuncio debe sobrevivir a ese desmontaje. */}
      <span className="sr-only" role="status">{anuncio}</span>
      <header className="registro-1to1__barra">
        <Link className="registro-1to1__volver" to={`/mentees/${id}`}>
          ← {nombre}
        </Link>
        <h1 className="registro-1to1__titulo">Nuevo 1-to-1</h1>
        <label className="registro-1to1__fecha" htmlFor="registro-1to1-fecha">
          <span className="registro-1to1__fecha-etiqueta">Fecha</span>
          <span className="campo-fecha">
            <input
              id="registro-1to1-fecha"
              className="campo-fecha__input"
              type="date"
              value={fecha}
              max={hoyISO()}
              aria-invalid={errorFecha !== null}
              aria-describedby={errorFecha !== null ? 'registro-1to1-error-fecha' : undefined}
              onChange={(e) => {
                setFecha(e.target.value);
                setErrorValidacion(null);
                setErrorFecha(null);
              }}
            />
            <span className="campo-fecha__texto" aria-hidden="true">
              {fecha !== '' ? fechaConAnio(fecha) : ''}
            </span>
          </span>
        </label>
        <span className="registro-1to1__estado">
          {guardando ? 'Guardado' : 'Borrador sin guardar'}
        </span>
        <div className="registro-1to1__acciones">
          <button className="boton boton--secundario" type="button" onClick={descartarBoton}>
            Descartar
          </button>
          <button
            className="boton boton--primario"
            type="button"
            onClick={() => void guardar()}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar 1-to-1'}
          </button>
        </div>
      </header>

      <div className="registro-1to1__cuerpo">
        <div className="registro-1to1__principal">
          {errorGuardado && (
            <div className="aviso aviso--error" role="alert">
              No se ha podido guardar. Inténtalo de nuevo.
            </div>
          )}
          {errorValidacion !== null && (
            <div
              className="aviso aviso--error"
              role="alert"
              id={errorFecha !== null ? 'registro-1to1-error-fecha' : undefined}
            >
              {errorValidacion}
            </div>
          )}

          {pendientesUltimo.length > 0 && (
            <section className="tarjeta registro-1to1__tarjeta" aria-label="Repasa los acuerdos del último 1-to-1">
              <h2 className="registro-1to1__etiqueta">1 · Repasa los acuerdos del último 1-to-1</h2>
              <ul className="registro-1to1__acuerdos">
                {pendientesUltimo.map((a) => (
                  <li key={a.id} className="registro-1to1__acuerdo">
                    <label className="check">
                      <input
                        type="checkbox"
                        checked={false}
                        onChange={() => marcarCumplido(a)}
                      />
                      <span className="registro-1to1__acuerdo-texto" id={`acuerdo-texto-${a.id}`}>
                        {a.text}
                      </span>
                    </label>
                    <button
                      className="accion registro-1to1__marcar"
                      type="button"
                      aria-label={`Marcar cumplido: ${a.text}`}
                      aria-describedby={`acuerdo-texto-${a.id}`}
                      onClick={() => marcarCumplido(a)}
                    >
                      Marcar cumplido
                    </button>
                  </li>
                ))}
                {cumplidosUltimo.map((a) => (
                  <li key={a.id} className="registro-1to1__acuerdo registro-1to1__acuerdo--cumplido">
                    <label className="check">
                      <input type="checkbox" checked disabled />
                      <span className="registro-1to1__acuerdo-texto registro-1to1__tachado">
                        {a.text}
                      </span>
                    </label>
                    <span className="badge badge--cumplido">Cumplido</span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section className="tarjeta registro-1to1__tarjeta" aria-label="Temas">
            <h2 className="registro-1to1__etiqueta">2 · Temas</h2>
            {temas.map((tema) => (
              <div className="registro-1to1__tema" key={tema.clave}>
                <div className="registro-1to1__tema-cabecera">
                  <label className="registro-1to1__pregunta" htmlFor={`nota-${tema.clave}`}>
                    {tema.pregunta}
                  </label>
                  {/* Chip «propio» (componentes.md §Chip, 14px/600, padding 5×12), no badge. */}
                  {tema.tipo === 'propio' && <span className="chip">propio</span>}
                  {tema.tipo === 'propio' && (
                    <button
                      className="accion accion--tenue registro-1to1__retirar"
                      type="button"
                      aria-label={`Retirar tema: ${tema.pregunta}`}
                      ref={(el) => {
                        retirarRefs.current[tema.clave] = el;
                      }}
                      onClick={() => setTemaARetirar(tema)}
                    >
                      Retirar tema
                    </button>
                  )}
                </div>
                <textarea
                  id={`nota-${tema.clave}`}
                  className="registro-1to1__textarea"
                  value={notas[tema.clave] ?? ''}
                  onChange={(e) => {
                    setNotas((actual) => ({ ...actual, [tema.clave]: e.target.value }));
                    setErrorValidacion(null);
                  }}
                />
              </div>
            ))}
            {altaTemaAbierta ? (
              <div className="registro-1to1__alta-tema">
                <label>
                  <span className="sr-only">Nuevo tema propio</span>
                  <input
                    type="text"
                    value={nuevoTemaPropio}
                    placeholder="p. ej. ¿Cómo llevas el cambio de horario?"
                    aria-invalid={errorAlta !== null}
                    aria-describedby={errorAlta !== null ? 'registro-1to1-error-alta' : undefined}
                    ref={(el) => {
                      campoAltaRef.current = el;
                    }}
                    onChange={(e) => setNuevoTemaPropio(e.target.value)}
                    onKeyDown={(e) => {
                      if (e.key === 'Enter') {
                        e.preventDefault();
                        void añadirTemaPropio();
                      }
                    }}
                  />
                </label>
                <button
                  className="boton boton--primario"
                  type="button"
                  disabled={añadiendo}
                  onClick={() => void añadirTemaPropio()}
                >
                  {añadiendo ? 'Añadiendo…' : 'Añadir tema'}
                </button>
                <button
                  className="boton boton--secundario"
                  type="button"
                  onClick={() => {
                    setAltaTemaAbierta(false);
                    setNuevoTemaPropio('');
                    setErrorAlta(null);
                  }}
                >
                  Cancelar
                </button>
                {errorAlta !== null && (
                  <span className="campo__error" id="registro-1to1-error-alta" role="alert">{errorAlta}</span>
                )}
              </div>
            ) : (
              <button
                className="registro-1to1__añadir-tema"
                type="button"
                ref={(el) => {
                  campoAltaRef.current = el;
                }}
                onClick={() => setAltaTemaAbierta(true)}
              >
                + Añadir tema propio
              </button>
            )}
          </section>

          <section className="tarjeta registro-1to1__tarjeta" aria-label="Acuerdos nuevos">
            <h2 className="registro-1to1__etiqueta">3 · Acuerdos nuevos</h2>
            <ul className="registro-1to1__acuerdos-nuevos">
              {acuerdosNuevos.map((texto, i) => (
                <li key={`${i}-${texto}`} className="registro-1to1__acuerdo-nuevo">
                  <span>{texto}</span>
                  <button
                    className="accion accion--tenue"
                    type="button"
                    aria-label={`Quitar: ${texto}`}
                    onClick={() => setAcuerdosNuevos((actual) => actual.filter((_, j) => j !== i))}
                  >
                    Quitar
                  </button>
                </li>
              ))}
            </ul>
            <div className="registro-1to1__nuevo-acuerdo">
              <label>
                <span className="sr-only">Nuevo acuerdo</span>
                <input
                  type="text"
                  value={nuevoAcuerdo}
                  placeholder="p. ej. Revisar la carga con el líder antes del 15 oct"
                  onChange={(e) => setNuevoAcuerdo(e.target.value)}
                  onKeyDown={(e) => {
                    if (e.key === 'Enter') {
                      e.preventDefault();
                      añadirAcuerdo();
                    }
                  }}
                />
              </label>
              <button className="boton boton--secundario" type="button" onClick={añadirAcuerdo}>
                Añadir acuerdo
              </button>
            </div>
          </section>
        </div>

        {/* Columna de contexto: en móvil es un `details` desplegable encima del
           formulario (< 640px, decisiones.md §Responsive); en escritorio es una
           columna fija, no colapsable (sin `summary` operable por teclado). */}
        {esMovil ? (
          <details
            className="registro-1to1__contexto"
            open={contextoAbierto}
            onToggle={(e) => setContextoAbierto(e.currentTarget.open)}
          >
            <summary className="registro-1to1__contexto-titulo">Contexto de {primerNombre(nombre)}</summary>
            {contextoContenido}
          </details>
        ) : (
          <div className="registro-1to1__contexto">
            <h2 className="registro-1to1__contexto-titulo">Contexto de {primerNombre(nombre)}</h2>
            {contextoContenido}
          </div>
        )}
      </div>

      <DialogoConfirmacion
        abierto={mostrarDescartar}
        titulo="¿Descartar el 1-to-1?"
        cancelar="Seguir escribiendo"
        confirmar="Descartar"
        onCancelar={cancelarDescartar}
        onConfirmar={confirmarDescartar}
      >
        <p>Lo que has escrito no se guardará.</p>
      </DialogoConfirmacion>

      <DialogoConfirmacion
        abierto={temaARetirar !== null}
        titulo={temaARetirar !== null ? `¿Retirar el tema «${temaARetirar.pregunta}»?` : ''}
        cancelar="Cancelar"
        confirmar="Retirar tema"
        enviando={retirando ? 'Retirando…' : undefined}
        confirmarDeshabilitado={retirando}
        onCancelar={() => setTemaARetirar(null)}
        onConfirmar={() => void confirmarRetirada()}
      >
        {temaARetirar !== null && (
          <p>
            Dejará de aparecer en los próximos 1-to-1s con {primerNombre(nombre)}. Los 1-to-1s ya
            registrados no cambian. Puedes volver a usarlo cuando quieras.
            {(notas[temaARetirar.clave] ?? '').trim() !== '' && (
              <> Lo que has escrito en este tema no se guardará.</>
            )}
          </p>
        )}
      </DialogoConfirmacion>
    </main>
  );
}

export interface DialogoConfirmacionProps {
  abierto: boolean;
  titulo: string;
  cancelar: string;
  confirmar: string;
  /** Gerundio del botón de confirmación durante el envío («Retirando…»); deshabilita. */
  enviando?: string;
  /** Deshabilita el botón de confirmación (P4 §Estados «Enviando»). */
  confirmarDeshabilitado?: boolean;
  onCancelar: () => void;
  onConfirmar: () => void;
  children: React.ReactNode;
}

/** `<dialog>` modal `alertdialog` (mismo componente que reutilizará #32). El foco
 *  inicial recae en «Cancelar» (primer botón), contrato del paquete. */
export function DialogoConfirmacion({
  abierto,
  titulo,
  cancelar,
  confirmar,
  enviando,
  confirmarDeshabilitado,
  onCancelar,
  onConfirmar,
  children,
}: DialogoConfirmacionProps) {
  const ref = useRef<HTMLDialogElement>(null);
  const idTitulo = useRef(`dialogo-${Math.random().toString(36).slice(2)}`).current;
  const idCuerpo = useRef(`dialogo-cuerpo-${Math.random().toString(36).slice(2)}`).current;

  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo === null) return;
    if (abierto && !dialogo.open) dialogo.showModal();
    else if (!abierto && dialogo.open) dialogo.close();
  }, [abierto]);

  return (
    <dialog
      ref={ref}
      className="dialogo"
      role="alertdialog"
      aria-labelledby={idTitulo}
      aria-describedby={idCuerpo}
      onCancel={(e) => {
        // Esc equivale a «Cancelar» (cierra sin confirmar).
        e.preventDefault();
        onCancelar();
      }}
    >
      <h2 id={idTitulo} className="dialogo__titulo">{titulo}</h2>
      <div id={idCuerpo} className="dialogo__cuerpo">{children}</div>
      <div className="dialogo__acciones">
        <button className="boton boton--secundario" type="button" onClick={onCancelar}>
          {cancelar}
        </button>
        <button
          className="boton boton--primario"
          type="button"
          disabled={confirmarDeshabilitado}
          onClick={onConfirmar}
        >
          {enviando ?? confirmar}
        </button>
      </div>
    </dialog>
  );
}