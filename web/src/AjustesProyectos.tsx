import { useEffect, useId, useRef, useState } from 'react';
import { api, type ProyectoCatalogo } from './api';
import { fechaMesAnio } from './lib/fechas';

/** Catálogo compartido: el recuento procede de las asignaciones vigentes de la API. */
export function AjustesProyectos() {
  const [proyectos, setProyectos] = useState<ProyectoCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [skeleton, setSkeleton] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [intento, setIntento] = useState(0);
  const [nombre, setNombre] = useState('');
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorGuardar, setErrorGuardar] = useState(false);
  const [errorReactivar, setErrorReactivar] = useState<string | null>(null);
  const [enviando, setEnviando] = useState<string | null>(null);
  const [retirar, setRetirar] = useState<ProyectoCatalogo | null>(null);
  const [aviso, setAviso] = useState('');
  const nombreRef = useRef<HTMLInputElement>(null);
  const vigentesRef = useRef<HTMLUListElement>(null);
  const retiradosRef = useRef<HTMLUListElement>(null);
  const disparador = useRef<HTMLElement | null>(null);
  const focoPendiente = useRef<(() => void) | null>(null);
  const activo = useRef(true);
  const base = useId();

  useEffect(() => {
    activo.current = true;
    return () => { activo.current = false; };
  }, []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setSkeleton(false);
    setErrorCarga(false);
    const reloj = window.setTimeout(() => { if (vigente) setSkeleton(true); }, 301);
    api.proyectos().then(({ proyectos: catalogo }) => {
      if (vigente) setProyectos(catalogo);
    }).catch(() => {
      if (vigente) setErrorCarga(true);
    }).finally(() => {
      if (!vigente) return;
      window.clearTimeout(reloj);
      setCargando(false);
      setSkeleton(false);
    });
    return () => { vigente = false; window.clearTimeout(reloj); };
  }, [intento]);

  // Tras mover una fila y desmontar el modal, enfoca un destino que siga existiendo.
  useEffect(() => {
    focoPendiente.current?.();
    focoPendiente.current = null;
  }, [proyectos, retirar]);

  const vigentes = proyectos.filter((p) => p.fechaRetirada === null).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const retirados = proyectos.filter((p) => p.fechaRetirada !== null).sort((a, b) => a.name.localeCompare(b.name, 'es'));
  const bloqueado = cargando || errorCarga || enviando !== null;

  async function añadir(e: React.FormEvent) {
    e.preventDefault();
    if (bloqueado) return;
    setErrorNombre(null);
    setErrorGuardar(false);
    if (nombre.trim() === '') {
      setErrorNombre('El nombre del proyecto no puede estar vacío');
      nombreRef.current?.focus();
      return;
    }
    setEnviando('alta');
    try {
      const creado = await api.addProyecto(nombre);
      if (!activo.current) return;
      setProyectos((lista) => [...lista, { ...creado, fechaRetirada: null, numMentees: 0 }]);
      setNombre('');
      setAviso(`Proyecto «${creado.name}» añadido.`);
      focoPendiente.current = () => nombreRef.current?.focus();
    } catch (err) {
      if (!activo.current) return;
      if (err instanceof Error && err.message === 'Ya existe un proyecto con ese nombre.') {
        setErrorNombre(err.message);
        nombreRef.current?.focus();
      } else setErrorGuardar(true);
    } finally {
      if (activo.current) setEnviando(null);
    }
  }

  async function reactivar(proyecto: ProyectoCatalogo) {
    if (bloqueado) return;
    const indice = retirados.findIndex((p) => p.id === proyecto.id);
    setEnviando(proyecto.id);
    setErrorReactivar(null);
    try {
      await api.reactivarProyecto(proyecto.id);
      if (!activo.current) return;
      setProyectos((lista) => lista.map((p) => p.id === proyecto.id ? { ...p, fechaRetirada: null } : p));
      setAviso(`Proyecto «${proyecto.name}» vuelve a estar activo.`);
      focoPendiente.current = () => {
        const botones = retiradosRef.current?.querySelectorAll<HTMLButtonElement>('button');
        (botones?.[indice] ?? botones?.[botones.length - 1] ?? nombreRef.current)?.focus();
      };
    } catch {
      if (activo.current) setErrorReactivar(proyecto.id);
    } finally {
      if (activo.current) setEnviando(null);
    }
  }

  async function confirmarRetirada() {
    if (retirar === null) return;
    const proyecto = retirar;
    const indice = vigentes.filter((p) => p.numMentees === 0).findIndex((p) => p.id === proyecto.id);
    const { fechaRetirada } = await api.retirarProyecto(proyecto.id);
    if (!activo.current) return;
    setProyectos((lista) => lista.map((p) => p.id === proyecto.id ? { ...p, fechaRetirada } : p));
    setRetirar(null);
    setAviso(`Proyecto «${proyecto.name}» retirado.`);
    focoPendiente.current = () => {
      const botones = vigentesRef.current?.querySelectorAll<HTMLButtonElement>('button');
      (botones?.[indice] ?? botones?.[botones.length - 1] ?? nombreRef.current)?.focus();
    };
  }

  function cancelarRetirada() {
    focoPendiente.current = () => { if (disparador.current?.isConnected) disparador.current.focus(); };
    setRetirar(null);
  }

  return <>
    <section className="tarjeta catalogo-proyectos" aria-label="Proyectos vigentes">
      <div className="catalogo-proyectos__cabecera">
        <h2>Proyectos vigentes · {cargando || errorCarga ? '—' : vigentes.length}</h2>
        <p>Aparecen al añadir una mentee a un proyecto. Solo se puede retirar un proyecto sin mentees.</p>
      </div>
      {cargando && skeleton && <div className="catalogo-proyectos__lista" aria-busy="true">
        <span className="sr-only">Cargando…</span>
        {[0, 1, 2].map((n) => <div key={n} className="catalogo-proyectos__skeleton" aria-hidden="true" />)}
      </div>}
      {errorCarga && <div className="aviso aviso--error" role="alert">
        <p>No hemos podido cargar los proyectos. Revisa tu conexión.</p>
        <button className="boton boton--secundario" onClick={reintentarCarga}>Reintentar</button>
      </div>}
      {!cargando && !errorCarga && <ul ref={vigentesRef} className="catalogo-proyectos__lista" aria-label="Proyectos vigentes">
        {vigentes.map((p) => <li className="catalogo-proyectos__fila" key={p.id}>
          <span className="catalogo-proyectos__nombre">{p.name}</span>
          <span className="catalogo-proyectos__meta">{p.numMentees === 0 ? 'Sin mentees' : `${p.numMentees} ${p.numMentees === 1 ? 'mentee' : 'mentees'}`}</span>
          {p.numMentees > 0 ? <span className="catalogo-proyectos__meta">Tiene mentees</span>
            : <button className="accion" disabled={bloqueado} aria-label={`Retirar proyecto: ${p.name}`} onClick={(e) => {
              disparador.current = e.currentTarget;
              setRetirar(p);
            }}>Retirar</button>}
        </li>)}
      </ul>}
      {!cargando && !errorCarga && vigentes.length === 0 && <p className="catalogo-proyectos__vacio">Añade un proyecto para que aparezca al añadir mentees a un proyecto.</p>}
      <form className="catalogo-proyectos__alta" onSubmit={añadir} noValidate aria-label="Añadir proyecto">
        <label className="campo">
          Nombre del proyecto
          <input ref={nombreRef} value={nombre} onChange={(e) => setNombre(e.target.value)} readOnly={enviando !== null}
            placeholder="p. ej. Nuevo cliente" required aria-invalid={errorNombre !== null}
            aria-describedby={errorNombre !== null ? `${base}-error` : undefined} />
          {errorNombre !== null && <span id={`${base}-error`} className="campo__error" role="alert">{errorNombre}</span>}
        </label>
        {errorGuardar && <div className="aviso aviso--error catalogo-proyectos__error" role="alert">No se ha podido guardar. Inténtalo de nuevo.</div>}
        <button className="boton boton--primario" disabled={bloqueado}>{enviando === 'alta' ? 'Añadiendo…' : 'Añadir proyecto'}</button>
      </form>
      <div className="sr-only" role="status">{aviso}</div>
    </section>
    {!cargando && !errorCarga && retirados.length > 0 && <section className="catalogo-proyectos__retirados" aria-label="Proyectos retirados">
      <h2>Retirados · {retirados.length}</h2>
      <ul ref={retiradosRef} className="catalogo-proyectos__lista" aria-label="Proyectos retirados">
        {retirados.map((p) => <li className="tarjeta tarjeta--plana catalogo-proyectos__retirado" key={p.id}>
          <span>{p.name}</span>
          <span className="badge badge--retirado">Retirado · <time dateTime={p.fechaRetirada!}>{fechaMesAnio(p.fechaRetirada!)}</time></span>
          <div className="catalogo-proyectos__reactivacion">
            {errorReactivar === p.id && <div className="aviso aviso--error" role="alert">No se ha podido guardar. Inténtalo de nuevo.</div>}
            <button className="accion" disabled={bloqueado} aria-label={`${enviando === p.id ? 'Activando…' : 'Volver a activar'}: ${p.name}`} onClick={() => void reactivar(p)}>
              {enviando === p.id ? 'Activando…' : 'Volver a activar'}
            </button>
          </div>
        </li>)}
      </ul>
    </section>}
    {retirar !== null && <RetiradaProyecto proyecto={retirar} onCancelar={cancelarRetirada} onConfirmar={confirmarRetirada} />}
  </>;

  function reintentarCarga() {
    setCargando(true);
    setErrorCarga(false);
    setIntento((n) => n + 1);
  }
}

function RetiradaProyecto({ proyecto, onCancelar, onConfirmar }: {
  proyecto: ProyectoCatalogo; onCancelar: () => void; onConfirmar: () => Promise<void>;
}) {
  const ref = useRef<HTMLDialogElement>(null);
  const cancelarRef = useRef<HTMLButtonElement>(null);
  const [enviando, setEnviando] = useState(false);
  const [error, setError] = useState(false);
  const base = useId();
  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
    cancelarRef.current?.focus();
    return () => { if (dialogo?.open) dialogo.close(); };
  }, []);

  async function confirmar() {
    if (enviando) return;
    setEnviando(true);
    setError(false);
    try { await onConfirmar(); }
    catch { setError(true); setEnviando(false); }
  }

  return <dialog ref={ref} className="dialogo" role="alertdialog" aria-labelledby={`${base}-titulo`} aria-describedby={`${base}-descripcion`}
    onCancel={(e) => { e.preventDefault(); if (!enviando) onCancelar(); }}
    onKeyDown={(e) => {
      if (e.key !== 'Tab' || enviando) return;
      const botones = e.currentTarget.querySelectorAll<HTMLButtonElement>('button');
      if (e.shiftKey && document.activeElement === botones[0]) { e.preventDefault(); botones[1]?.focus(); }
      else if (!e.shiftKey && document.activeElement === botones[1]) { e.preventDefault(); botones[0]?.focus(); }
    }}>
    <h2 className="dialogo__titulo" id={`${base}-titulo`}>¿Retirar {proyecto.name} del catálogo?</h2>
    <div className="dialogo__cuerpo" id={`${base}-descripcion`}>
      Dejará de aparecer al añadir mentees a un proyecto. Las entradas y salidas pasadas que lo mencionan se mantienen en el historial. Puedes volver a activarlo cuando quieras.
    </div>
    {error && <div className="aviso aviso--error" role="alert">No se ha podido guardar. Inténtalo de nuevo.</div>}
    <div className="dialogo__acciones">
      <button ref={cancelarRef} className="boton boton--secundario" disabled={enviando} onClick={onCancelar}>Cancelar</button>
      <button className="boton boton--primario" disabled={enviando} onClick={() => void confirmar()}>{enviando ? 'Retirando…' : 'Retirar proyecto'}</button>
    </div>
  </dialog>;
}
