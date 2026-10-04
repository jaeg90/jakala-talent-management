import { useEffect, useState } from 'react';
import { Link, useLocation, useNavigate } from 'react-router';
import type { Mentee } from './api';
import { api } from './api';
import { useAuth } from './auth';
import { CabeceraGlobal } from './CabeceraGlobal';
import { fechaISO, fechaRelativa } from './lib/fechas';
import { iniciales, tonoAvatar } from './lib/avatar';

/**
 * Mi equipo — panel de atención (spec §02): cabecera global, saludo y contador,
 * y una tabla una fila por mentee con sus señales y proyectos. El orden y la
 * señal «Necesita atención» los calcula el backend (regla de dominio).
 */
export function Equipo() {
  const { manager } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const aviso = (location.state as { aviso?: string } | null)?.aviso;
  const [mentees, setMentees] = useState<Mentee[] | null>(null);
  const [error, setError] = useState(false);
  const [skeleton, setSkeleton] = useState(false);

  function cargar() {
    setError(false);
    setMentees(null);
    setSkeleton(false);
    // P4 (§Estados «Cargando»): mostrar el skeleton solo si la carga tarda más
    // de 300 ms. En una carga rápida, el clearTimeout lo cancela y no hay flash.
    const inicio = Date.now();
    const reloj = window.setTimeout(() => {
      if (Date.now() - inicio > 300) setSkeleton(true);
    }, 300);
    api
      .team()
      .then(({ mentees: equipo }) => {
        window.clearTimeout(reloj);
        setMentees(equipo);
      })
      .catch(() => {
        window.clearTimeout(reloj);
        setError(true);
      });
  }

  useEffect(() => {
    cargar();
  }, []);

  return (
    <>
      <CabeceraGlobal />

      <main className="equipo">
        <div className="equipo__cabecera">
          <div className="equipo__titulos">
            <p className="equipo__saludo">Hola, {primerNombre(manager?.name ?? '')}</p>
            <h1>Mi equipo</h1>
          </div>
          {mentees !== null && mentees.length > 0 && !error && (
            <span className="equipo__contador">
              {contador(mentees.length)} · primero quien necesita atención
            </span>
          )}
        </div>

        {aviso && <div className="aviso aviso--exito" role="status">{aviso}</div>}

        {error ? (
          <div className="estado" role="alert">
            <p className="estado__mensaje">No hemos podido cargar Mi equipo. Revisa tu conexión.</p>
            <button className="boton boton--secundario" type="button" onClick={cargar}>
              Reintentar
            </button>
          </div>
        ) : mentees === null ? (
          skeleton ? (
            <div className="tabla-skeleton" aria-busy="true" data-testid="skeleton-equipo">
              <span className="sr-only">Cargando…</span>
              {Array.from({ length: 6 }, (_, i) => (
                <div className="tabla-skeleton__fila" key={i} aria-hidden="true" />
              ))}
            </div>
          ) : null
        ) : mentees.length === 0 ? (
          <div className="estado">
            <p className="estado__mensaje">Aún no tienes mentees en tu equipo.</p>
            <Link className="boton boton--secundario" to="/ajustes/mentees">
              Añadir mentee
            </Link>
          </div>
        ) : (
          <div className="tarjeta panel-tabla">
            <table className="tabla">
              <caption className="sr-only">Mi equipo</caption>
              <colgroup>
                <col />
                <col />
                <col />
                <col />
                <col />
                <col />
              </colgroup>
              <thead>
                <tr>
                  <th scope="col">Mentee</th>
                  <th scope="col">Proyectos</th>
                  <th scope="col">Acuerdos</th>
                  <th scope="col">Incidencias</th>
                  <th scope="col">Objetivos</th>
                  <th scope="col">Último 1-to-1</th>
                </tr>
              </thead>
              <tbody>
                {mentees.map((m) => (
                  <Fila
                    key={m.id}
                    mentee={m}
                    onAbrir={() => navigate(`/mentees/${m.id}`)}
                  />
                ))}
              </tbody>
            </table>
          </div>
        )}
      </main>
    </>
  );
}

function Fila({ mentee, onAbrir }: { mentee: Mentee; onAbrir: () => void }) {
  // La fila es clicable con el ratón y también activable por teclado (Enter),
  // con foco visible (accesibilidad.md §Globales). Solo se activa cuando el foco
  // está en la propia fila: si el Enter viene del enlace del nombre, este ya
  // navega y no debe re-dispararse la navegación de la fila.
  function activarPorTeclado(e: React.KeyboardEvent<HTMLTableRowElement>) {
    if (e.key !== 'Enter' || e.target !== e.currentTarget) return;
    e.preventDefault();
    onAbrir();
  }

  return (
    <tr
      className={mentee.necesitaAtencion ? 'fila fila--atencion' : 'fila'}
      onClick={onAbrir}
      tabIndex={0}
      onKeyDown={activarPorTeclado}
    >
      <td className="td-mentee">
        <div className="td-mentee__contenido">
          <Link
            className="fila__mentee"
            to={`/mentees/${mentee.id}`}
            data-name={mentee.name}
            onClick={(e) => e.stopPropagation()}
          >
            <span className={`avatar avatar--lista avatar--${tonoAvatar(mentee.id)}`} aria-hidden="true">
              {iniciales(mentee.name)}
            </span>
            {mentee.name}
          </Link>
          {mentee.necesitaAtencion && (
            <span className="fila__atencion">Necesita atención</span>
          )}
        </div>
      </td>
      <td>
        {mentee.proyectos.length === 0 ? (
          <span className="texto-secundario">Sin proyecto</span>
        ) : (
          <ul className="lista-proyectos" aria-label={`Proyectos de ${mentee.name}`}>
            {mentee.proyectos.map((proyecto) => (
              <li key={proyecto}>{proyecto}</li>
            ))}
          </ul>
        )}
      </td>
      <td>
        <Numero valor={mentee.acuerdosPendientes} />
      </td>
      <td>
        {mentee.incidenciasAbiertas === 0 ? (
          <Guion />
        ) : (
          <span className="badge badge--atencion">
            <span aria-hidden="true">
              {mentee.incidenciasAbiertas}{' '}
              {mentee.incidenciasAbiertas === 1 ? 'abierta' : 'abiertas'}
            </span>
            <span className="sr-only">
              {mentee.incidenciasAbiertas}{' '}
              {mentee.incidenciasAbiertas === 1 ? 'incidencia abierta' : 'incidencias abiertas'}
            </span>
          </span>
        )}
      </td>
      <td>
        <Numero valor={mentee.objetivosEnCurso} />
      </td>
      <td>
        <UltimoUnoAUno mentee={mentee} />
      </td>
    </tr>
  );
}

function Numero({ valor }: { valor: number }) {
  return valor === 0 ? <Guion /> : <span className="numero">{valor}</span>;
}

/** «—» decorativo con equivalente textual (accesibilidad.md §Globales). */
function Guion() {
  return (
    <span className="guion" aria-label="ninguno">
      —
    </span>
  );
}

function UltimoUnoAUno({ mentee }: { mentee: Mentee }) {
  // Sin ningún 1-to-1 previo → badge «Sin 1-to-1s» (nunca «—»: el «—» es solo
  // para los valores cero de acuerdos/incidencias/objetivos). Ticket #17, §02.
  if (mentee.ultimoUnoAUno === null) {
    return (
      <span className="badge badge--atencion">Sin 1-to-1s</span>
    );
  }
  const relativa = fechaRelativa(mentee.ultimoUnoAUno);
  const iso = fechaISO(mentee.ultimoUnoAUno);
  // El badge de antigüedad lo decide el backend (badgeAntiguedad): aparece solo
  // cuando el último 1-to-1 tiene más de 14 días. Si la atención viene de una
  // incidencia con el 1-to-1 reciente, la fecha se muestra sin badge.
  if (mentee.badgeAntiguedad) {
    return (
      <time className="badge badge--atencion" dateTime={iso}>
        <span aria-hidden="true">{relativa}</span>
        <span className="sr-only">último 1-to-1 {relativa}</span>
      </time>
    );
  }
  return (
    <time className="numero" dateTime={iso}>
      {relativa}
    </time>
  );
}

function primerNombre(nombre: string): string {
  return nombre.split(/\s+/)[0] ?? '';
}

function contador(n: number): string {
  return n === 1 ? '1 mentee' : `${n} mentees`;
}
