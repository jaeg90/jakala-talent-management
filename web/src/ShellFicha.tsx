import { useEffect, useRef, useState } from 'react';
import { Link, NavLink, Outlet, useParams } from 'react-router';
import type { Mentee } from './api';
import { api } from './api';
import { useAuth } from './auth';
import { iniciales, tonoAvatar } from './lib/avatar';

/**
 * Shell de la ficha de mentee (spec §Esqueletos «Ficha de mentee [v2]»): sidebar
 * con «← Mi equipo», avatar + nombre (sin proyectos) y el nav de secciones; el
 * contenido de cada pantalla va en el `Outlet`. Sin cabecera global.
 */
export function ShellFicha() {
  const { id } = useParams();
  const { manager, logout } = useAuth();
  const [mentee, setMentee] = useState<Mentee | null>(null);
  const [error, setError] = useState(false);
  const [skeleton, setSkeleton] = useState(false);
  const [incidenciasAbiertas, setIncidenciasAbiertas] = useState(0);
  // Contador de solicitudes: al cambiar de mentee, las respuestas atrasadas de la
  // lectura anterior se descartan y no sobrescriben el estado de la nueva (ni la
  // mentee, ni el error, ni el punto terracota de incidencias).
  const solicitudRef = useRef(0);
  // Generación vigente de la ficha, expuesta por el outlet context. «Incidencias»
  // la devuelve como token de sus refrescos del punto terracota: si una operación
  // atrasada de la mentee anterior termina después de cambiar de mentee, su token
  // discrepa de la generación vigente y esa lectura se descarta (estado asíncrono
  // compartido: una respuesta atrasada nunca sobrescribe el punto de otra mentee).
  const [solicitud, setSolicitud] = useState(0);

  // Recuenta las incidencias abiertas (punto terracota). Descarta la respuesta cuando
  // el token (`token`; o la generación vigente si el contenedor se llama a sí mismo)
  // ya no coincide con `solicitudRef` al resolver. El `id` disparado es el de la
  // ficha en ese instante: si el token llegó atrasado, la respuesta se descarta
  // igualmente y el punto no se sobrescribe.
  function refrescarIncidencias(token?: number) {
    if (id === undefined) return;
    const vigente = token ?? solicitudRef.current;
    api
      .incidenciasDe(id)
      .then(({ incidencias }) => {
        if (vigente !== solicitudRef.current) return;
        setIncidenciasAbiertas(incidencias.filter((i) => i.estado === 'abierta').length);
      })
      .catch(() => {});
  }

  function cargar() {
    if (id === undefined) return;
    const nuevaSolicitud = ++solicitudRef.current;
    setSolicitud(nuevaSolicitud);
    setError(false);
    setMentee(null);
    setSkeleton(false);
    // Al cambiar de mentee, el punto no debe conservar el contador de la anterior
    // hasta que resuelva la nueva lectura de incidencias (defecto del punto terracota).
    setIncidenciasAbiertas(0);
    // P4 (§Estados «Cargando»): skeleton solo si la carga tarda más de 300 ms
    // (mismo patrón que Mi equipo y el Resumen; en carga rápida el clearTimeout
    // lo cancela y no hay flash).
    const inicio = Date.now();
    const reloj = window.setTimeout(() => {
      if (nuevaSolicitud !== solicitudRef.current) return;
      if (Date.now() - inicio > 300) setSkeleton(true);
    }, 300);
    api
      .team()
      .then(({ mentees }) => {
        if (nuevaSolicitud !== solicitudRef.current) return;
        window.clearTimeout(reloj);
        setMentee(mentees.find((m) => m.id === id) ?? null);
      })
      .catch(() => {
        if (nuevaSolicitud !== solicitudRef.current) return;
        window.clearTimeout(reloj);
        setError(true);
      });
    // El punto terracota es una señal, no bloquea la ficha: si falla, queda sin punto.
    refrescarIncidencias();
  }

  useEffect(() => {
    cargar();
  }, [id]);

  if (id === undefined) return null;
  if (error) return <ErrorAlCargarFicha onReintentar={cargar} />;
  if (mentee === null) return <CargandoFicha skeleton={skeleton} />;

  return (
    <div className="ficha">
      <aside className="ficha__sidebar">
        <Link className="ficha__volver" to="/equipo">← Mi equipo</Link>

        <div className="ficha__identidad">
          <span className={`avatar avatar--ficha avatar--${tonoAvatar(mentee.id)}`} aria-hidden="true">
            {iniciales(mentee.name)}
          </span>
          <span className="ficha__nombre">{mentee.name}</span>
        </div>

        <nav className="ficha__nav" aria-label={`Secciones de ${mentee.name}`}>
          <NavLink to={`/mentees/${id}`} end>Resumen</NavLink>
          <NavLink to={`/mentees/${id}/1-to-1s`}>1-to-1s</NavLink>
          <NavLink to={`/mentees/${id}/objetivos`}>Objetivos</NavLink>
          <NavLink to={`/mentees/${id}/incidencias`}>
            Incidencias
            {incidenciasAbiertas > 0 && (
              <>
                <span className="ficha__punto" aria-hidden="true" />
                <span className="sr-only">(hay incidencias abiertas)</span>
              </>
            )}
          </NavLink>
          <NavLink to={`/mentees/${id}/historial`}>Historial</NavLink>
          <NavLink to={`/mentees/${id}/ajustes`} className="ficha__nav-ajustes">
            Ajustes de la mentee
          </NavLink>
        </nav>

        <div className="ficha__pie">
          <Link to="/ajustes/perfil">Ajustes</Link>
          <span className="ficha__pie-sep" aria-hidden="true">·</span>
          <span>{manager?.name}</span>
          <span className="ficha__pie-sep" aria-hidden="true">·</span>
          <button className="ficha__logout" type="button" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </aside>

      <main className="ficha__contenido">
        <Outlet context={{ refrescarIncidencias, solicitud }} />
      </main>
    </div>
  );
}

function CargandoFicha({ skeleton }: { skeleton: boolean }) {
  if (!skeleton) return null;
  return (
    <div className="ficha-skeleton" aria-busy="true" data-testid="skeleton-ficha">
      <span className="sr-only">Cargando…</span>
      <div className="ficha-skeleton__sidebar" aria-hidden="true">
        <div className="ficha-skeleton__barra ficha-skeleton__volver" />
        <div className="ficha-skeleton__identidad">
          <div className="ficha-skeleton__barra ficha-skeleton__avatar" />
          <div className="ficha-skeleton__barra ficha-skeleton__nombre" />
        </div>
        <div className="ficha-skeleton__nav">
          {Array.from({ length: 6 }, (_, i) => (
            <div className="ficha-skeleton__barra ficha-skeleton__nav-item" key={i} />
          ))}
        </div>
        <div className="ficha-skeleton__barra ficha-skeleton__pie" />
      </div>
      <div className="ficha-skeleton__contenido" aria-hidden="true">
        <div className="resumen-skeleton__cabecera" />
        <div className="resumen-skeleton__grid">
          <div className="resumen-skeleton__tarjeta" />
          <div className="resumen-skeleton__tarjeta" />
        </div>
      </div>
    </div>
  );
}

/** Error de carga de la mentee (P4 §Estados «Error de carga»): aviso + reintento.
 *  Vive dentro de un `main` (accesibilidad.md §Globales «header / nav / main»). */
function ErrorAlCargarFicha({ onReintentar }: { onReintentar: () => void }) {
  return (
    <main className="cargando">
      <p className="estado__mensaje" role="alert">
        No hemos podido cargar la ficha. Revisa tu conexión.
      </p>
      <button className="boton boton--secundario" type="button" onClick={onReintentar}>
        Reintentar
      </button>
    </main>
  );
}