import { useEffect, useRef, useState } from 'react';
import { Link } from 'react-router';
import { api, type ProyectoCatalogo } from './api';
import { hoyISO } from './lib/fechas';

/** Ajustes · Mentees (#26): alta con historial vacío y cero o varios proyectos. */
export function AjustesMentees() {
  const [nombre, setNombre] = useState('');
  const [desde, setDesde] = useState(hoyISO);
  const [marcados, setMarcados] = useState<string[]>([]);
  const [proyectos, setProyectos] = useState<ProyectoCatalogo[]>([]);
  const [cargando, setCargando] = useState(true);
  const [skeleton, setSkeleton] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [intento, setIntento] = useState(0);
  const [enviando, setEnviando] = useState(false);
  const [errorGuardar, setErrorGuardar] = useState(false);
  const [errorNombre, setErrorNombre] = useState<string | null>(null);
  const [errorFecha, setErrorFecha] = useState<string | null>(null);
  const [creada, setCreada] = useState<{ id: string; name: string } | null>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const fechaRef = useRef<HTMLInputElement>(null);
  const hoy = hoyISO();

  useEffect(() => {
    let activo = true;
    setCargando(true);
    setSkeleton(false);
    setErrorCarga(false);
    const reloj = window.setTimeout(() => { if (activo) setSkeleton(true); }, 301);
    api.proyectos().then(({ proyectos: catalogo }) => {
      if (!activo) return;
      setProyectos(catalogo.filter((p) => p.fechaRetirada === null).sort((a, b) => a.name.localeCompare(b.name, 'es')));
    }).catch(() => {
      if (activo) setErrorCarga(true);
    }).finally(() => {
      if (!activo) return;
      window.clearTimeout(reloj);
      setCargando(false);
      setSkeleton(false);
    });
    return () => { activo = false; window.clearTimeout(reloj); };
  }, [intento]);

  async function enviar(e: React.FormEvent) {
    e.preventDefault();
    if (cargando || errorCarga || enviando) return;
    setErrorNombre(null);
    setErrorFecha(null);
    setErrorGuardar(false);
    setCreada(null);
    if (nombre.trim() === '') {
      setErrorNombre('Escribe el nombre y apellidos.');
      nombreRef.current?.focus();
      return;
    }
    if (desde === '' || desde > hoy) {
      setErrorFecha(desde === '' ? 'Escribe una fecha válida.' : 'La fecha no puede ser futura.');
      fechaRef.current?.focus();
      return;
    }
    setEnviando(true);
    try {
      const mentee = await api.addMentee({ name: nombre, proyectos: marcados, enEquipoDesde: desde });
      setCreada(mentee);
      setNombre('');
      setMarcados([]);
      setDesde(hoyISO());
      nombreRef.current?.focus();
    } catch (err) {
      if (err instanceof Error && err.message === 'La fecha no puede ser futura.') {
        setErrorFecha(err.message);
        fechaRef.current?.focus();
      } else {
        setErrorGuardar(true);
      }
    } finally {
      setEnviando(false);
    }
  }

  return (
    <>
      {creada !== null && (
        <div className="aviso aviso--exito alta-mentee__exito" role="status">
          <span>{creada.name} se ha añadido a tu equipo.</span>
          <Link to={`/mentees/${creada.id}`}>Abrir su ficha</Link>
        </div>
      )}
      <form className="tarjeta alta-mentee" onSubmit={enviar} noValidate aria-label="Añadir mentee">
        <div className="alta-mentee__cabecera">
          <h2>Añadir mentee</h2>
          <p>La mentee entra en tu equipo con el historial vacío. Si viene de otro manager, pídele un traspaso: así conserva su historial.</p>
        </div>
        <label className="campo">
          Nombre y apellidos
          <input ref={nombreRef} value={nombre} onChange={(e) => setNombre(e.target.value)}
            required placeholder="p. ej. Irene Iglesias" autoComplete="name" readOnly={enviando}
            aria-invalid={errorNombre !== null} aria-describedby={errorNombre !== null ? 'alta-error-nombre' : undefined} />
          {errorNombre !== null && <span id="alta-error-nombre" className="campo__error" role="alert">{errorNombre}</span>}
        </label>
        <fieldset className="alta-mentee__proyectos" disabled={cargando || errorCarga || enviando} aria-describedby="alta-ayuda-proyectos">
          <legend>Proyectos</legend>
          {cargando && skeleton && (
            <div className="alta-mentee__chips" aria-busy="true">
              <span className="sr-only">Cargando…</span>
              {[0, 1, 2].map((n) => <span className="skeleton alta-mentee__skeleton" aria-hidden="true" key={n} />)}
            </div>
          )}
          {!cargando && !errorCarga && (
            <div className="alta-mentee__chips">
              {proyectos.map((proyecto) => (
                <label className="chip-casilla" key={proyecto.id}>
                  <input type="checkbox" checked={marcados.includes(proyecto.id)} onChange={(e) => {
                    setMarcados(e.target.checked ? [...marcados, proyecto.id] : marcados.filter((id) => id !== proyecto.id));
                  }} />
                  <span className="chip-casilla__texto">
                    {marcados.includes(proyecto.id) && <span aria-hidden="true">✓ </span>}{proyecto.name}
                  </span>
                </label>
              ))}
            </div>
          )}
          <p id="alta-ayuda-proyectos" className="alta-mentee__ayuda">Puedes marcar varios o ninguno («Sin proyecto»).</p>
        </fieldset>
        {errorCarga && (
          <div className="aviso aviso--error" role="alert">
            <p>No hemos podido cargar los proyectos. Revisa tu conexión.</p>
            <button type="button" className="boton boton--secundario" onClick={() => setIntento((n) => n + 1)}>Reintentar</button>
          </div>
        )}
        <label className="campo alta-mentee__fecha">
          En tu equipo desde
          <input ref={fechaRef} type="date" value={desde} max={hoy} required readOnly={enviando}
            onChange={(e) => setDesde(e.target.value)} aria-invalid={errorFecha !== null}
            aria-describedby={errorFecha !== null ? 'alta-error-fecha' : undefined} />
          {errorFecha !== null && <span id="alta-error-fecha" className="campo__error" role="alert">{errorFecha}</span>}
        </label>
        {errorGuardar && <div className="aviso aviso--error" role="alert">No se ha podido guardar. Inténtalo de nuevo.</div>}
        <button className="boton boton--primario alta-mentee__boton" type="submit" disabled={cargando || errorCarga || enviando}>
          {enviando ? 'Añadiendo…' : 'Añadir a mi equipo'}
        </button>
      </form>
    </>
  );
}
