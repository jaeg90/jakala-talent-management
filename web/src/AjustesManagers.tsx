import { useEffect, useId, useRef, useState } from 'react';
import { api, type ManagerCenso } from './api';
import { useAuth } from './auth';
import { useAjustesManagers } from './AjustesManagersEstado';

/** Censo y formulario; el alta en vuelo y su resultado pertenecen al contenedor. */
export function AjustesManagers() {
  const { manager } = useAuth();
  const { creada, enviando, crearManager, crearRef, devolverFoco } = useAjustesManagers();
  const [managers, setManagers] = useState<ManagerCenso[]>([]);
  const [cargando, setCargando] = useState(true);
  const [skeleton, setSkeleton] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [intento, setIntento] = useState(0);
  const [nombre, setNombre] = useState('');
  const [email, setEmail] = useState('');
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorEmail, setErrorEmail] = useState<string | null>(null);
  const [errorGuardar, setErrorGuardar] = useState(false);
  const nombreRef = useRef<HTMLInputElement>(null);
  const emailRef = useRef<HTMLInputElement>(null);
  const activo = useRef(true);
  const base = useId();

  useEffect(() => {
    activo.current = true;
    return () => { activo.current = false; };
  }, []);

  useEffect(() => {
    let vigente = true;
    setCargando(true);
    setErrorCarga(false);
    setSkeleton(false);
    const reloj = window.setTimeout(() => { if (vigente) setSkeleton(true); }, 301);
    api.managers().then(({ managers: censo }) => {
      if (vigente) setManagers((lista) => [...censo, ...lista.filter((m) => !censo.some((actual) => actual.id === m.id))]);
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

  useEffect(() => {
    if (creada) {
      setManagers((lista) => lista.some((m) => m.id === creada.manager.id) ? lista : [...lista, creada.manager]);
      setNombre('');
      setEmail('');
    }
  }, [creada]);

  const bloqueado = cargando || errorCarga || enviando;
  useEffect(() => {
    // El cierre puede ocurrir con el censo cargando o en error: no perdemos
    // el retorno pendiente y lo reintentamos cuando el disparador se habilita.
    if (creada === null && !bloqueado) devolverFoco();
  }, [creada, bloqueado, devolverFoco]);

  const censo = [...managers].sort((a, b) => {
    if (a.id === manager?.id) return -1;
    if (b.id === manager?.id) return 1;
    return a.name.localeCompare(b.name, 'es');
  });

  async function crear(e: React.FormEvent) {
    e.preventDefault();
    if (bloqueado) return;
    setErrorNombre(null);
    setErrorEmail(null);
    setErrorGuardar(false);
    if (nombre.trim() === '') {
      setErrorNombre('Escribe el nombre y apellidos.');
      nombreRef.current?.focus();
      return;
    }
    // Solo plegamos mayúsculas ASCII: Unicode como K no puede convertirse en un email válido.
    const correo = email.trim().replace(/[A-Z]/g, (letra) => letra.toLowerCase());
    if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(correo)) {
      setErrorEmail('Escribe un email válido.');
      emailRef.current?.focus();
      return;
    }
    try {
      const respuesta = await crearManager(nombre, correo);
      if (!activo.current) return;
      setManagers((lista) => [...lista, respuesta.manager]);
      setNombre('');
      setEmail('');
    } catch (err) {
      if (!activo.current) return;
      const mensaje = err instanceof Error ? err.message : '';
      if (mensaje === 'Ya existe una cuenta con este email.' || mensaje === 'Escribe un email válido.') {
        setErrorEmail(mensaje);
        emailRef.current?.focus();
      } else setErrorGuardar(true);
    }
  }

  return <>
    <section className="tarjeta censo-managers" aria-label="Managers">
      {cargando && skeleton && <div aria-busy="true">
        <span className="sr-only">Cargando…</span>
        {[0, 1, 2].map((n) => <div key={n} className="censo-managers__skeleton" aria-hidden="true" />)}
      </div>}
      {errorCarga && <div className="aviso aviso--error" role="alert">
        <p>No hemos podido cargar los managers. Revisa tu conexión.</p>
        <button className="boton boton--secundario" onClick={() => {
          setCargando(true); setErrorCarga(false); setIntento((n) => n + 1);
        }}>Reintentar</button>
      </div>}
      {!cargando && !errorCarga && <table className="censo-managers__tabla">
        <caption className="sr-only">Managers</caption>
        <thead><tr><th scope="col">Manager</th><th scope="col">Mentees</th></tr></thead>
        <tbody>{censo.map((m) => <tr key={m.id}>
          <td><span className="censo-managers__nombre">{m.name}</span>{m.id === manager?.id && <span> (tú)</span>}
            <span className="censo-managers__email">{m.email}</span></td>
          <td>{m.numMentees}</td>
        </tr>)}</tbody>
      </table>}
    </section>
    <form className="tarjeta alta-manager" onSubmit={crear} noValidate aria-label="Crear cuenta de manager">
      <div className="alta-manager__cabecera">
        <h2>Crear cuenta de manager</h2>
        <p>Empezará con el equipo vacío, la plantilla de 1-to-1 inicial y verá solo a sus mentees.</p>
      </div>
      <div className="contrasena__fila">
        <label className="campo"><span id={`${base}-nombre-label`}>Nombre y apellidos</span>
          <input ref={nombreRef} value={nombre} onChange={(e) => setNombre(e.target.value)} required readOnly={enviando}
            autoComplete="off" aria-labelledby={`${base}-nombre-label`} aria-invalid={errorNombre !== null} aria-describedby={errorNombre ? `${base}-nombre` : undefined} />
          {errorNombre && <span className="campo__error" id={`${base}-nombre`} role="alert">{errorNombre}</span>}
        </label>
        <label className="campo"><span id={`${base}-email-label`}>Email</span>
          <input ref={emailRef} type="email" value={email} onChange={(e) => setEmail(e.target.value)} required readOnly={enviando}
            autoComplete="off" aria-labelledby={`${base}-email-label`} aria-invalid={errorEmail !== null} aria-describedby={errorEmail ? `${base}-email` : undefined} />
          {errorEmail && <span className="campo__error" id={`${base}-email`} role="alert">{errorEmail}</span>}
        </label>
      </div>
      <div className="alta-manager__temporal">
        <h3>Contraseña temporal</h3>
        <p>JTM genera una al crear la cuenta. Compártela por un canal seguro; tendrá que cambiarla al iniciar sesión.</p>
      </div>
      {errorGuardar && <div className="aviso aviso--error" role="alert">No se ha podido guardar. Inténtalo de nuevo.</div>}
      <button ref={crearRef} className="boton boton--primario" disabled={bloqueado}>{enviando ? 'Creando cuenta…' : 'Crear cuenta'}</button>
    </form>
  </>;
}

export function CuentaCreada({ nombre, temporal, onCerrar }: { nombre: string; temporal: string; onCerrar: () => void }) {
  const ref = useRef<HTMLDialogElement>(null);
  const copiarRef = useRef<HTMLButtonElement>(null);
  const [copiada, setCopiada] = useState(false);
  const [error, setError] = useState(false);
  const base = useId();
  useEffect(() => {
    const dialogo = ref.current;
    if (dialogo && !dialogo.open) dialogo.showModal();
    copiarRef.current?.focus();
    return () => { if (dialogo?.open) dialogo.close(); };
  }, []);

  async function copiar() {
    setError(false);
    try { await navigator.clipboard.writeText(temporal); setCopiada(true); }
    catch { setError(true); }
  }

  return <dialog ref={ref} className="dialogo" aria-labelledby={`${base}-titulo`} aria-describedby={`${base}-aviso`}
    onCancel={(e) => { e.preventDefault(); onCerrar(); }}
    onKeyDown={(e) => {
      if (e.key !== 'Tab') return;
      const botones = e.currentTarget.querySelectorAll<HTMLButtonElement>('button');
      if (e.shiftKey && document.activeElement === botones[0]) { e.preventDefault(); botones[1]?.focus(); }
      else if (!e.shiftKey && document.activeElement === botones[1]) { e.preventDefault(); botones[0]?.focus(); }
    }}>
    <h2 className="dialogo__titulo" id={`${base}-titulo`}>Cuenta creada para {nombre}</h2>
    <div className="dialogo__cuerpo">
      <p>Contraseña temporal</p>
      <p className="alta-manager__clave">{temporal}</p>
      <p id={`${base}-aviso`}>No volverás a verla.</p>
    </div>
    <div className="sr-only" role="status">{copiada ? 'Contraseña copiada.' : ''}</div>
    {error && <div className="aviso aviso--error" role="alert">No se ha podido copiar. Selecciona la contraseña y cópiala.</div>}
    <div className="dialogo__acciones">
      <button ref={copiarRef} className="boton boton--primario" onClick={() => void copiar()}>Copiar contraseña</button>
      <button className="boton boton--secundario" onClick={onCerrar}>Hecho</button>
    </div>
  </dialog>;
}
