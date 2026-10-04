import { useEffect, useId, useRef, useState } from 'react';
import { useNavigate, useParams } from 'react-router';
import { api, type Manager, type Project, type ProyectoActual } from './api';
import { useAuth } from './auth';
import { fechaConAnio, fechaMesAnio, hoyISO } from './lib/fechas';
import { DialogoConfirmacion } from './RegistrarUnoAUno';

/** Ajustes §08/§15. La clave aísla formularios y peticiones de cada mentee. */
export function AjustesMentee() {
  const { id } = useParams();
  return id === undefined ? null : <PantallaAjustes key={id} menteeId={id} />;
}

type Datos = { nombre: string; actuales: ProyectoActual[]; catalogo: Project[]; managers: Manager[] };
type Valores = { destino: string; fecha: string; motivo: string };
type Errores = Partial<Record<keyof Valores, string>>;
type Accion = { tipo: 'alta'; destino: Project; valores: Valores }
  | { tipo: 'traspaso'; destino: Manager; valores: Valores }
  | { tipo: 'salida'; proyecto: ProyectoActual };

function PantallaAjustes({ menteeId }: { menteeId: string }) {
  const { manager } = useAuth();
  const navigate = useNavigate();
  const [datos, setDatos] = useState<Datos | null>(null);
  const [error, setError] = useState(false);
  const [skeleton, setSkeleton] = useState(false);
  const [aviso, setAviso] = useState<string | null>(null);
  const [accion, setAccion] = useState<Accion | null>(null);
  const [reinicioAlta, setReinicioAlta] = useState(0);
  const solicitud = useRef(0);
  const altaRef = useRef<HTMLButtonElement>(null);
  const salidaRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const [destinoFoco, setDestinoFoco] = useState<string | null>(null);

  function cargar() {
    const token = ++solicitud.current;
    setDatos(null);
    setError(false);
    setSkeleton(false);
    const reloj = window.setTimeout(() => {
      if (token === solicitud.current) setSkeleton(true);
    }, 301);
    Promise.all([api.team(), api.proyectosActuales(menteeId), api.proyectos(), api.managers()])
      .then(([equipo, actuales, catalogo, managers]) => {
        if (token !== solicitud.current) return;
        window.clearTimeout(reloj);
        setDatos({
          nombre: equipo.mentees.find((m) => m.id === menteeId)?.name ?? '',
          actuales: actuales.proyectos.sort((a, b) => a.name.localeCompare(b.name, 'es')),
          catalogo: catalogo.proyectos.filter((p) => p.fechaRetirada === null).sort((a, b) => a.name.localeCompare(b.name, 'es')),
          managers: managers.managers.filter((m) => m.id !== manager?.id),
        });
      })
      .catch(() => {
        if (token !== solicitud.current) return;
        window.clearTimeout(reloj);
        setError(true);
      });
  }

  useEffect(() => {
    cargar();
    // Una mutación atrasada tampoco puede navegar ni enfocar la mentee nueva.
    return () => { ++solicitud.current; };
  }, []);

  useEffect(() => {
    if (destinoFoco === null) return;
    if (destinoFoco === 'alta') {
      if (altaRef.current?.disabled) {
        altaRef.current.closest('form')?.querySelector<HTMLInputElement>('input[type="date"]')?.focus();
      } else altaRef.current?.focus();
    }
    else salidaRefs.current[destinoFoco]?.focus();
    setDestinoFoco(null);
  }, [destinoFoco]);

  async function confirmar(valores: Valores) {
    if (accion === null || datos === null) return;
    const token = solicitud.current;
    if (accion.tipo === 'traspaso') {
      await api.traspasar(menteeId, {
        destinoId: accion.destino.id, fecha: valores.fecha, motivo: valores.motivo.trim(),
      });
      if (token !== solicitud.current) return;
      navigate('/equipo', { state: { aviso: `${datos.nombre} se ha traspasado a ${accion.destino.name}.` } });
      return;
    }
    if (accion.tipo === 'alta') {
      const asignacion = await api.entrarEnProyecto(menteeId, {
        proyecto: accion.destino.id, desde: valores.fecha, motivoEntrada: valores.motivo.trim(),
      });
      if (token !== solicitud.current) return;
      // El POST devuelve la asignación; el estado se deriva de la acción confirmada,
      // sin convertir un fallo de refresco posterior en un falso fallo de guardado.
      setDatos({ ...datos, actuales: [...datos.actuales, {
        id: accion.destino.id, name: accion.destino.name, desde: asignacion.desde,
      }].sort((a, b) => a.name.localeCompare(b.name, 'es')) });
      setAviso(`${datos.nombre} ahora también está en ${accion.destino.name}.`);
      setReinicioAlta((n) => n + 1);
      setDestinoFoco('alta');
    } else {
      await api.salirDeProyecto(menteeId, accion.proyecto.id, {
        hasta: valores.fecha, motivoSalida: valores.motivo.trim(),
      });
      if (token !== solicitud.current) return;
      const indice = datos.actuales.findIndex((p) => p.id === accion.proyecto.id);
      const restantes = datos.actuales.filter((p) => p.id !== accion.proyecto.id);
      setDatos({ ...datos, actuales: restantes });
      setAviso(`${datos.nombre} ya no está en ${accion.proyecto.name}.`);
      // Siguiente fila; si era la última, primera restante; si se vacía, alta.
      setDestinoFoco((restantes[indice] ?? restantes[0])?.id ?? 'alta');
    }
    setAccion(null);
  }

  return (
    <div className="ajustes-mentee">
      <header className="ficha__cabecera"><h1>Ajustes de la mentee</h1></header>
      <section id="temas-propios" className="tarjeta ajustes-mentee__tarjeta" aria-label="Temas propios">
        <h2>Temas propios</h2>
        {/* Hueco y ancla de #32; sin gestión de temas en este ticket. */}
      </section>
      {aviso !== null && <div className="aviso aviso--exito" role="status">{aviso}</div>}
      {error ? (
        <div className="estado" role="alert">
          <p className="estado__mensaje">No hemos podido cargar los ajustes de la mentee. Revisa tu conexión.</p>
          <button className="boton boton--secundario" type="button" onClick={cargar}>Reintentar</button>
        </div>
      ) : datos === null ? (
        skeleton && <div className="ajustes-mentee__grid" aria-busy="true" data-testid="skeleton-ajustes-mentee">
          <span className="sr-only">Cargando…</span>
          <div className="resumen-skeleton__tarjeta" aria-hidden="true" />
          <div className="resumen-skeleton__tarjeta" aria-hidden="true" />
        </div>
      ) : (
        <div className="ajustes-mentee__grid">
          <section className="tarjeta ajustes-mentee__tarjeta" aria-label="Proyectos">
            <h2>Proyectos</h2>
            <p className="ajustes-mentee__descripcion">Puede estar en varios a la vez. Cada entrada y salida queda en su historial.</p>
            {datos.actuales.length === 0 ? <p className="ajustes-mentee__descripcion">Sin proyecto.</p> : (
              <ul className="ajustes-mentee__actuales" aria-label="Proyectos actuales">
                {datos.actuales.map((p) => <li className="fila fila--gestion" key={p.id}>
                  <span className="fila--gestion__nombre">{p.name}</span>
                  <span className="fila--gestion__meta">desde <time dateTime={p.desde}>{fechaMesAnio(p.desde)}</time></span>
                  <button className="accion" type="button" aria-label={`Sacar del proyecto: ${p.name}`}
                    ref={(el) => { salidaRefs.current[p.id] = el; }}
                    onClick={() => setAccion({ tipo: 'salida', proyecto: p })}>Sacar del proyecto…</button>
                </li>)}
              </ul>
            )}
            <div className="ajustes-mentee__alta">
              <h3>Añadir a un proyecto</h3>
              <FormularioAccion key={reinicioAlta} tipo="alta"
                opciones={datos.catalogo.filter((p) => !datos.actuales.some((a) => a.id === p.id))}
                botonRef={altaRef} onConfirmar={(destino, valores) => setAccion({ tipo: 'alta', destino, valores })} />
            </div>
          </section>
          <section className="tarjeta ajustes-mentee__tarjeta" aria-label="Traspaso">
            <h2>Traspaso</h2>
            <p className="ajustes-mentee__descripcion">El nuevo manager hereda el historial completo.</p>
            <FormularioAccion tipo="traspaso" opciones={datos.managers}
                onConfirmar={(destino, valores) => {
                  const elegido = datos.managers.find((m) => m.id === destino.id);
                  if (elegido) setAccion({ tipo: 'traspaso', destino: elegido, valores });
                }} />
          </section>
        </div>
      )}
      {accion !== null && datos !== null && <ConfirmacionAjustes
        accion={accion} nombre={datos.nombre} actuales={datos.actuales}
        onCancelar={() => setAccion(null)} onConfirmar={confirmar} />}
    </div>
  );
}

function errorFecha(fecha: string, proyecto?: ProyectoActual, noFutura = true): string | undefined {
  if (fecha === '') return 'Elige una fecha.';
  if (noFutura && fecha > hoyISO()) return 'La fecha no puede ser futura.';
  if (proyecto && fecha < proyecto.desde) {
    return `No puede ser anterior a su entrada en ${proyecto.name} (${fechaConAnio(proyecto.desde)}).`;
  }
  return undefined;
}

function FormularioAccion({ tipo, opciones, botonRef, onConfirmar }: {
  tipo: 'alta' | 'traspaso'; opciones: Project[] | Manager[];
  botonRef?: React.Ref<HTMLButtonElement>;
  onConfirmar: (destino: Project | Manager, valores: Valores) => void;
}) {
  const [valores, setValores] = useState<Valores>({ destino: '', fecha: hoyISO(), motivo: '' });
  const [errores, setErrores] = useState<Errores>({});
  const formRef = useRef<HTMLFormElement>(null);
  const base = useId();
  const alta = tipo === 'alta';
  const cambiar = (campo: keyof Valores, valor: string) => {
    setValores({ ...valores, [campo]: valor });
    setErrores({ ...errores, [campo]: undefined });
  };

  function enviar(e: React.FormEvent) {
    e.preventDefault();
    const destino = opciones.find((p) => p.id === valores.destino);
    const nuevos: Errores = {
      destino: destino === undefined ? (alta ? 'Elige un proyecto.' : 'Elige un manager.') : undefined,
      fecha: errorFecha(valores.fecha, undefined, alta),
      motivo: valores.motivo.trim() === '' ? 'Escribe el motivo.' : undefined,
    };
    setErrores(nuevos);
    if (Object.values(nuevos).some(Boolean)) {
      window.setTimeout(() => formRef.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
    } else if (destino !== undefined) onConfirmar(destino, valores);
  }

  return <form ref={formRef} className="ajustes-mentee__formulario" onSubmit={enviar} noValidate>
    <label className="campo" htmlFor={`${base}-destino`}>
      <span id={`${base}-etiqueta-destino`}>{alta ? 'Proyecto' : 'Nuevo manager'}</span>
      <select id={`${base}-destino`} value={valores.destino} required disabled={opciones.length === 0}
        aria-labelledby={`${base}-etiqueta-destino`}
        aria-invalid={!!errores.destino} aria-describedby={errores.destino ? `${base}-error-destino` : undefined}
        onChange={(e) => cambiar('destino', e.target.value)}>
        <option value="">{alta ? 'Elige un proyecto' : 'Elige un manager'}</option>
        {opciones.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
      </select>
      {errores.destino && <span className="campo__error" id={`${base}-error-destino`}>{errores.destino}</span>}
    </label>
    {alta && opciones.length === 0 && <p className="ajustes-mentee__descripcion">Ya está en todos los proyectos vigentes.</p>}
    <CamposFechaMotivo base={base} valores={valores} errores={errores} cambiar={cambiar} noFutura={alta} />
    <button ref={botonRef} className="boton boton--secundario" type="submit" disabled={opciones.length === 0}>
      {alta ? 'Añadir al proyecto…' : 'Traspasar…'}
    </button>
  </form>;
}

function CamposFechaMotivo({ base, valores, errores, cambiar, proyecto, noFutura }: {
  base: string; valores: Valores; errores: Errores;
  cambiar: (campo: keyof Valores, valor: string) => void;
  proyecto?: ProyectoActual; noFutura: boolean;
}) {
  return <>
    <div className="ajustes-mentee__fecha">
      <label htmlFor={`${base}-fecha`}>Fecha</label>
      <span className="campo-fecha">
        <input id={`${base}-fecha`} className="campo-fecha__input" type="date" required
          value={valores.fecha} max={noFutura ? hoyISO() : undefined} min={proyecto?.desde}
          aria-invalid={!!errores.fecha} aria-describedby={errores.fecha ? `${base}-error-fecha` : undefined}
          onChange={(e) => cambiar('fecha', e.target.value)} />
        <span className={`campo-fecha__texto${errores.fecha ? ' campo-fecha__texto--error' : ''}`} aria-hidden="true">
          {valores.fecha !== '' ? fechaConAnio(valores.fecha) : ''}
        </span>
      </span>
      {errores.fecha && <span className="campo__error" id={`${base}-error-fecha`}>{errores.fecha}</span>}
    </div>
    <label className="campo" htmlFor={`${base}-motivo`}>
      <span id={`${base}-etiqueta-motivo`}>Motivo</span>
      <textarea id={`${base}-motivo`} className={proyecto ? 'ajustes-mentee__motivo-salida' : 'ajustes-mentee__motivo'}
        aria-labelledby={`${base}-etiqueta-motivo`}
        required value={valores.motivo} aria-invalid={!!errores.motivo}
        aria-describedby={errores.motivo ? `${base}-error-motivo` : undefined}
        onChange={(e) => cambiar('motivo', e.target.value)} />
      {errores.motivo && <span className="campo__error" id={`${base}-error-motivo`}>{errores.motivo}</span>}
    </label>
  </>;
}

function ConfirmacionAjustes({ accion, nombre, actuales, onCancelar, onConfirmar }: {
  accion: Accion; nombre: string; actuales: ProyectoActual[];
  onCancelar: () => void; onConfirmar: (valores: Valores) => Promise<void>;
}) {
  const salida = accion.tipo === 'salida';
  const [valores, setValores] = useState<Valores>(salida
    ? { destino: '', fecha: hoyISO(), motivo: '' } : accion.valores);
  const fechaInicial = useRef(valores.fecha).current;
  const [errores, setErrores] = useState<Errores>({});
  const [enviando, setEnviando] = useState(false);
  const [errorGuardado, setErrorGuardado] = useState(false);
  const [descartar, setDescartar] = useState(false);
  const ref = useRef<HTMLDialogElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const disparador = useRef<HTMLElement | null>(null);
  const base = useId();
  const destino = salida ? accion.proyecto.name : accion.destino.name;
  const verbo = salida ? 'Sacar' : accion.tipo === 'alta' ? 'Añadir' : 'Traspasar';
  const otros = salida ? actuales.filter((p) => p.id !== accion.proyecto.id).map((p) => p.name).join(' · ') : '';
  const descripcion = salida
    ? `${otros ? `Seguirá en ${otros}.` : `${nombre} quedará sin proyecto.`} Quedará registrado en su historial con la fecha y el motivo.`
    : accion.tipo === 'alta' ? 'Quedará registrado en su historial con la fecha y el motivo.'
      : `${destino} heredará su historial completo y ${nombre} dejará de aparecer en tu equipo. No se puede deshacer.`;

  useEffect(() => {
    disparador.current = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
    cancelarRef.current?.focus();
    return () => { if (dialogo?.open) dialogo.close(); };
  }, []);

  function cerrar() {
    ref.current?.close();
    const destino = disparador.current;
    onCancelar();
    // Si está encima el diálogo de descarte, el modal aún impide enfocar fuera.
    // Tras desmontar ambos, vuelve al disparador si sigue en esta ficha.
    window.setTimeout(() => { if (destino?.isConnected) destino.focus(); }, 0);
  }
  function pedirCerrar() {
    if (enviando) return;
    if (salida && (valores.motivo !== '' || valores.fecha !== fechaInicial)) setDescartar(true);
    else cerrar();
  }
  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (enviando) return;
    if (salida) {
      const nuevos: Errores = {
        fecha: errorFecha(valores.fecha, accion.proyecto),
        motivo: valores.motivo.trim() === '' ? 'Escribe el motivo.' : undefined,
      };
      setErrores(nuevos);
      if (Object.values(nuevos).some(Boolean)) {
        window.setTimeout(() => ref.current?.querySelector<HTMLElement>('[aria-invalid="true"]')?.focus(), 0);
        return;
      }
    }
    setEnviando(true);
    setErrorGuardado(false);
    try {
      // El padre desmonta el diálogo y decide el foco al quitar una fila.
      await onConfirmar(valores);
    } catch {
      setEnviando(false);
      setErrorGuardado(true);
    }
  }

  return <>
    <dialog ref={ref} className="dialogo dialogo--formulario" role="alertdialog"
      aria-labelledby={`${base}-titulo`} aria-describedby={`${base}-descripcion`}
      onKeyDown={(e) => {
        if (e.key !== 'Tab') return;
        const campos = Array.from(e.currentTarget.querySelectorAll<HTMLElement>(
          'button:not(:disabled), input:not(:disabled), textarea:not(:disabled), select:not(:disabled)',
        ));
        const primero = campos[0];
        const ultimo = campos[campos.length - 1];
        if (e.shiftKey && document.activeElement === primero) {
          e.preventDefault(); ultimo?.focus();
        } else if (!e.shiftKey && document.activeElement === ultimo) {
          e.preventDefault(); primero?.focus();
        }
      }}
      onCancel={(e) => { e.preventDefault(); pedirCerrar(); }}>
      <div className="dialogo__cabecera">
        <h2 className="dialogo__titulo" id={`${base}-titulo`}>¿{verbo} a {nombre} {salida ? 'de' : 'a'} {destino}?</h2>
        <p className="dialogo__subtitulo" id={`${base}-descripcion`}>{descripcion}</p>
      </div>
      <form className="dialogo__formulario" onSubmit={enviar} noValidate>
        {salida && <fieldset className="ajustes-mentee__campos-salida" disabled={enviando}>
          <CamposFechaMotivo base={base} valores={valores} errores={errores} proyecto={accion.proyecto} noFutura
            cambiar={(campo, valor) => {
              setValores({ ...valores, [campo]: valor });
              setErrores({ ...errores, [campo]: undefined });
            }} />
        </fieldset>}
        {errorGuardado && <div className="aviso aviso--error" role="alert">No se ha podido guardar. Inténtalo de nuevo.</div>}
        <div className="dialogo__acciones">
          <button ref={cancelarRef} className="boton boton--secundario" type="button" disabled={enviando} onClick={pedirCerrar}>Cancelar</button>
          {salida && <span className="sr-only" id={`${base}-ayuda`}>Escribe el motivo para continuar.</span>}
          <button className={`boton boton--${accion.tipo === 'traspaso' ? 'atencion' : 'primario'}`} type="submit"
            aria-describedby={salida && valores.motivo.trim() === '' ? `${base}-ayuda` : undefined}
            disabled={enviando || (salida && valores.motivo.trim() === '')}>
            {enviando ? (salida ? 'Sacando…' : accion.tipo === 'alta' ? 'Añadiendo…' : 'Traspasando…')
              : `${verbo} ${salida ? 'de' : 'a'} ${destino}`}
          </button>
        </div>
      </form>
    </dialog>
    <DialogoConfirmacion abierto={descartar} titulo="¿Descartar los cambios?" cancelar="Seguir editando"
      confirmar="Descartar cambios" onCancelar={() => { setDescartar(false); cancelarRef.current?.focus(); }}
      onConfirmar={() => { setDescartar(false); cerrar(); }}>
      <p>Lo que has escrito no se guardará.</p>
    </DialogoConfirmacion>
  </>;
}
