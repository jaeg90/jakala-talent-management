import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type {
  AcuerdoView,
  Incidencia,
  Objetivo,
  ProyectoActual,
  TemaPropio,
} from './api';
import { api } from './api';
import { fechaCorta, fechaISO, fechaMesAnio, fechaRelativa } from './lib/fechas';

/**
 * Resumen de la ficha de mentee (spec §03 [v2]): el vistazo de la relación con la
 * mentee — próximo 1-to-1 (acuerdos, temas propios, último 1-to-1) y los proyectos
 * actuales, incidencias abiertas y objetivos en curso.
 */
export function Resumen() {
  const { id } = useParams();
  const [searchParams] = useSearchParams();
  // Aviso de éxito tras registrar un 1-to-1 (spec §04: «1-to-1 del 29 sept guardado.»);
  // llega como `?guardado=YYYY-MM-DD` desde Registrar 1-to-1.
  const guardado = searchParams.get('guardado');
  const [ultimaFecha, setUltimaFecha] = useState<string | null>(null);
  const [cita, setCita] = useState<string | null>(null);
  const [ultimoId, setUltimoId] = useState<string | null>(null);
  const [pendientes, setPendientes] = useState<AcuerdoView[] | null>(null);
  const [temas, setTemas] = useState<TemaPropio[] | null>(null);
  const [proyectos, setProyectos] = useState<ProyectoActual[] | null>(null);
  const [incidencias, setIncidencias] = useState<Incidencia[] | null>(null);
  const [objetivos, setObjetivos] = useState<Objetivo[] | null>(null);
  const [error, setError] = useState(false);
  const [skeleton, setSkeleton] = useState(false);
  // Contador de solicitudes: al cambiar de mentee, una carga antigua que resuelva
  // después de la nueva se descarta y no pinta datos de la mentee anterior.
  const solicitudRef = useRef(0);

  function cargar() {
    if (id === undefined) return;
    const solicitud = ++solicitudRef.current;
    setError(false);
    setPendientes(null);
    setTemas(null);
    setProyectos(null);
    setIncidencias(null);
    setObjetivos(null);
    setSkeleton(false);
    // P4 (§Estados «Cargando»): skeleton solo si la carga tarda más de 300 ms
    // (mismo patrón que Mi equipo; en carga rápida el clearTimeout lo cancela).
    const inicio = Date.now();
    const reloj = window.setTimeout(() => {
      if (solicitud !== solicitudRef.current) return;
      if (Date.now() - inicio > 300) setSkeleton(true);
    }, 300);
    Promise.all([
      api.ficha(id),
      api.temasPropios(id),
      api.proyectosActuales(id),
      api.incidenciasDe(id),
      api.objetivos(id),
    ])
      .then(([ficha, temasResp, proyectosResp, incidenciasResp, objetivosResp]) => {
        if (solicitud !== solicitudRef.current) return;
        window.clearTimeout(reloj);
        const ultimo = ficha.history[ficha.history.length - 1];
        setUltimaFecha(ultimo?.date ?? null);
        setUltimoId(ultimo?.id ?? null);
        setCita(ultimo ? primeraNota(ultimo.notas.map((n) => n.nota)) : null);
        setPendientes(ficha.pending);
        setTemas(temasResp.temas.filter((t) => t.estado === 'vigente'));
        setProyectos(proyectosResp.proyectos);
        setIncidencias(incidenciasResp.incidencias);
        setObjetivos(objetivosResp.objetivos);
      })
      .catch(() => {
        if (solicitud !== solicitudRef.current) return;
        window.clearTimeout(reloj);
        setError(true);
      });
  }

  useEffect(() => {
    cargar();
  }, [id]);

  if (error) {
    return (
      <div className="resumen">
        <ErrorAlCargar onReintentar={cargar} />
      </div>
    );
  }

  if (pendientes === null || temas === null || proyectos === null || incidencias === null || objetivos === null) {
    return skeleton ? (
      <div className="resumen" aria-busy="true" data-testid="skeleton-resumen">
        <span className="sr-only">Cargando…</span>
        <div className="resumen-skeleton__cabecera" aria-hidden="true" />
        <div className="resumen-skeleton__grid" aria-hidden="true">
          <div className="resumen-skeleton__tarjeta" />
          <div className="resumen-skeleton__tarjeta" />
        </div>
      </div>
    ) : null;
  }

  const abiertas = incidencias.filter((i) => i.estado === 'abierta');
  const enCurso = objetivos.filter((o) => o.estado === 'en curso');

  return (
    <div className="resumen">
      <header className="ficha__cabecera">
        <div className="ficha__titulos">
          <h1>Resumen</h1>
          {ultimaFecha === null ? (
            <p className="ficha__subtitulo">Aún no habéis tenido ningún 1-to-1</p>
          ) : (
            <p className="ficha__subtitulo">
              Vuestro último 1-to-1 fue{' '}
              <time dateTime={fechaISO(ultimaFecha)}>{fechaRelativa(ultimaFecha)}</time>
            </p>
          )}
        </div>
        <Link className="boton boton--primario" to={`/mentees/${id}/1-to-1s/nuevo`}>
          Registrar 1-to-1
        </Link>
      </header>

      {guardado !== null && (
        <div className="aviso aviso--exito" role="status">
          1-to-1 del <time dateTime={fechaISO(guardado)}>{fechaCorta(guardado)}</time> guardado.
        </div>
      )}

      <div className="resumen__grid">
        <section className="tarjeta resumen__proximo" aria-label="Para vuestro siguiente 1-to-1">
          <h2 className="resumen__proximo-titulo">Para vuestro siguiente 1-to-1</h2>

          <AcuerdosPendientes pendientes={pendientes} />

          <TemasPropiosChips temas={temas} menteeId={id ?? ''} />

          {ultimaFecha !== null && (
            <UltimoUnoAUno
              fecha={ultimaFecha}
              cita={cita}
              unoAUnoId={ultimoId}
              menteeId={id ?? ''}
            />
          )}
        </section>

        <div className="resumen__columna">
          <ProyectosActuales proyectos={proyectos} />

          {abiertas.length > 0 && <IncidenciasAbiertas incidencias={abiertas} />}

          <ObjetivosEnCurso objetivos={enCurso} menteeId={id ?? ''} />
        </div>
      </div>
    </div>
  );
}

function AcuerdosPendientes({ pendientes }: { pendientes: AcuerdoView[] }) {
  // Ids de los acuerdos cumplidos en esta vista (accesibilidad.md §Checkbox de
  // acuerdo: una vez cumplido el checkbox queda `disabled` y se anuncia «Cumplido»,
  // en vez de eliminarse de la lista).
  const [cumplidos, setCumplidos] = useState<ReadonlySet<string>>(new Set());
  const [error, setError] = useState(false);
  const [anuncio, setAnuncio] = useState('');

  useEffect(() => {
    setCumplidos(new Set());
  }, [pendientes]);

  async function marcarCumplido(acuerdoId: string) {
    setError(false);
    try {
      await api.completeAgreement(acuerdoId);
      setAnuncio('Cumplido');
      setCumplidos((actual) => new Set(actual).add(acuerdoId));
    } catch {
      setError(true);
    }
  }

  // Los acuerdos cumplidos en esta vista dejan de contar como pendientes: la
  // etiqueta refleja solo los que quedan por cumplir (spec §03 «Acuerdos pendientes · N»).
  const pendientesRestantes = pendientes.filter((a) => !cumplidos.has(a.id)).length;

  return (
    <section className="resumen__bloque" aria-label="Acuerdos pendientes">
      <h3 className="resumen__etiqueta">
        Acuerdos pendientes{pendientesRestantes > 0 ? ` · ${pendientesRestantes}` : ''}
      </h3>
      <span className="sr-only" role="status">{anuncio}</span>
      {error && (
        <p className="aviso aviso--error" role="alert">
          No se ha podido guardar. Inténtalo de nuevo.
        </p>
      )}
      {pendientes.length === 0 ? (
        <p className="resumen__vacio">
          No hay acuerdos pendientes. Los que acordéis en el próximo 1-to-1 aparecerán aquí.
        </p>
      ) : (
        <ul className="resumen__acuerdos">
          {pendientes.map((a) => {
            const cumplido = cumplidos.has(a.id);
            return (
              <li key={a.id}>
                <label className="check">
                  <input
                    type="checkbox"
                    checked={cumplido}
                    disabled={cumplido}
                    onChange={() => void marcarCumplido(a.id)}
                  />
                  <span className="resumen__acuerdo-texto">{a.text}</span>
                </label>
                <time className="resumen__acuerdo-fecha" dateTime={a.date}>
                  del {fechaCorta(a.date)}
                </time>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}

function TemasPropiosChips({ temas, menteeId }: { temas: TemaPropio[]; menteeId: string }) {
  return (
    <section className="resumen__bloque" aria-label="Temas propios">
      <div className="resumen__bloque-titulo">
        <h3 className="resumen__etiqueta">Temas propios</h3>
        <Link className="accion" to={`/mentees/${menteeId}/ajustes#temas-propios`}>
          Gestionar temas propios
        </Link>
      </div>
      {temas.length === 0 ? (
        <p className="resumen__vacio">
          Sin temas propios. Añádelos en Ajustes de la mentee o al registrar un 1-to-1.
        </p>
      ) : (
        <ul className="resumen__chips">
          {temas.map((t) => (
            <li key={t.id} className="chip">{t.tema}</li>
          ))}
        </ul>
      )}
    </section>
  );
}

function UltimoUnoAUno({
  fecha,
  cita,
  unoAUnoId,
  menteeId,
}: {
  fecha: string;
  cita: string | null;
  unoAUnoId: string | null;
  menteeId: string;
}) {
  return (
    <section className="resumen__bloque" aria-label="Último 1-to-1">
      <h3 className="resumen__etiqueta">Del último 1-to-1 · {fechaCorta(fecha)}</h3>
      {cita !== null && <p className="resumen__cita">«{cita}»</p>}
      <Link className="accion" to={`/mentees/${menteeId}/1-to-1s/${unoAUnoId ?? ''}`}>
        Ver 1-to-1 completo
      </Link>
    </section>
  );
}

function ProyectosActuales({ proyectos }: { proyectos: ProyectoActual[] }) {
  return (
    <section className="tarjeta resumen__proyectos" aria-label="Proyectos actuales">
      <h2 className="resumen__titulo-secundario">Proyectos actuales</h2>
      {proyectos.length === 0 ? (
        <p className="resumen__vacio">Sin proyectos. Añádela a uno en Ajustes de la mentee.</p>
      ) : (
        <ul className="resumen__proyectos-lista">
          {proyectos.map((p) => (
            <li key={p.id}>
              <span className="resumen__proyecto-nombre">{p.name}</span>
              <time className="resumen__proyecto-desde" dateTime={p.desde}>
                desde {fechaMesAnio(p.desde)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function IncidenciasAbiertas({ incidencias }: { incidencias: Incidencia[] }) {
  const etiqueta =
    incidencias.length === 1 ? '1 incidencia abierta' : `${incidencias.length} incidencias abiertas`;
  return (
    <section className="tarjeta tarjeta--atencion resumen__incidencias" aria-label="Incidencias abiertas">
      <h2 className="resumen__titulo-atencion">{etiqueta}</h2>
      {incidencias.map((incidencia) => (
        <div key={incidencia.id}>
          <p className="resumen__incidencia-descripcion">{incidencia.descripcion}</p>
          <time className="resumen__incidencia-fecha" dateTime={incidencia.fechaAlta}>
            {fechaRelativa(incidencia.fechaAlta)}
          </time>
        </div>
      ))}
    </section>
  );
}

function ObjetivosEnCurso({ objetivos, menteeId }: { objetivos: Objetivo[]; menteeId: string }) {
  return (
    <section className="tarjeta resumen__objetivos" aria-label="Objetivos en curso">
      <h2 className="resumen__titulo-objetivos">Objetivos en curso</h2>
      {objetivos.length === 0 ? (
        <>
          <p className="resumen__vacio">Sin objetivos en curso.</p>
          <Link className="accion" to={`/mentees/${menteeId}/objetivos?nuevo=1`}>
            Nuevo objetivo
          </Link>
        </>
      ) : (
        <ul className="resumen__objetivos-lista">
          {objetivos.map((o) => (
            <li key={o.id}>
              <span className="resumen__objetivo-titulo">{o.titulo}</span>
              <time className="resumen__objetivo-fecha" dateTime={o.fechaLimite}>
                hasta {fechaMesAnio(o.fechaLimite)}
              </time>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}

function ErrorAlCargar({ onReintentar }: { onReintentar: () => void }) {
  return (
    <div className="estado" role="alert">
      <p className="estado__mensaje">No hemos podido cargar el Resumen. Revisa tu conexión.</p>
      <button className="boton boton--secundario" type="button" onClick={onReintentar}>
        Reintentar
      </button>
    </div>
  );
}

/** Primera nota no vacía de un 1-to-1 (spec §03 cita). */
function primeraNota(notas: string[]): string | null {
  for (const nota of notas) {
    if (nota.trim() !== '') return nota;
  }
  return null;
}