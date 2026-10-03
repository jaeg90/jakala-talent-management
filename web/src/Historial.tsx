import { useEffect, useRef, useState } from 'react';
import { Link, useParams, useSearchParams } from 'react-router';
import type { EventoHistorial, FiltroHistorial } from './api';
import { api } from './api';
import { etiquetaGrupoHistorial, isoGrupoHistorial } from './lib/fechas';

/** Filtros del historial en el orden de §07; el primero («Todo») no filtra. */
const FILTROS: { clave: FiltroHistorial | null; etiqueta: string }[] = [
  { clave: null, etiqueta: 'Todo' },
  { clave: '1-to-1s', etiqueta: '1-to-1s' },
  { clave: 'objetivos', etiqueta: 'Objetivos' },
  { clave: 'incidencias', etiqueta: 'Incidencias' },
  { clave: 'proyectos', etiqueta: 'Proyectos' },
  { clave: 'traspasos', etiqueta: 'Traspasos' },
];

/** Mapa del filtro `?tipo=` al tipo de evento (mismo contrato del backend). */
const FILTRO_A_TIPO: Record<FiltroHistorial, EventoHistorial['tipo']> = {
  '1-to-1s': '1-to-1',
  objetivos: 'objetivo',
  incidencias: 'incidencia',
  proyectos: 'proyecto',
  traspasos: 'traspaso',
};

function tipoDesdeFiltro(filtro: FiltroHistorial): EventoHistorial['tipo'] {
  return FILTRO_A_TIPO[filtro];
}

/** Grupo del timeline: etiqueta de mes/año, su `datetime` ISO para `<time>` y los
 *  eventos que contiene, ya ordenados. */
interface GrupoHistorial {
  etiqueta: string;
  datetime: string;
  eventos: EventoHistorial[];
}

/**
 * Historial de la mentee (spec §07): feed cronológico unificado con filtros por
 * tipo y timeline agrupado por mes (año en curso) o año (anteriores). La
 * agregación vive en el backend (ADR-0007); aquí solo se agrupa y se renderiza.
 */
export function Historial() {
  const { id } = useParams();
  const [searchParams, setSearchParams] = useSearchParams();
  const [eventos, setEventos] = useState<EventoHistorial[] | null>(null);
  const [error, setError] = useState(false);
  const [skeleton, setSkeleton] = useState(false);
  const solicitudRef = useRef(0);

  const tipo = searchParams.get('tipo');

  function cargar() {
    if (id === undefined) return;
    const solicitud = ++solicitudRef.current;
    setError(false);
    setEventos(null);
    setSkeleton(false);
    const inicio = Date.now();
    const reloj = window.setTimeout(() => {
      if (solicitud !== solicitudRef.current) return;
      if (Date.now() - inicio > 300) setSkeleton(true);
    }, 300);
    api
      .historial(id)
      .then(({ eventos: lista }) => {
        if (solicitud !== solicitudRef.current) return;
        window.clearTimeout(reloj);
        setEventos(lista);
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

  function cambiarFiltro(filtro: FiltroHistorial | null) {
    if (filtro === null) {
      setSearchParams({}, { replace: true });
    } else {
      setSearchParams({ tipo: filtro }, { replace: true });
    }
  }

  if (error) {
    return (
      <section className="historial" aria-label="Historial">
        <header className="ficha__cabecera">
          <div className="ficha__titulos">
            <h1>Historial</h1>
          </div>
        </header>
        <div className="estado" role="alert">
          <p className="estado__mensaje">No hemos podido cargar el Historial. Revisa tu conexión.</p>
          <button className="boton boton--secundario" type="button" onClick={cargar}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (eventos === null) {
    if (!skeleton) return null;
    return (
      <section className="historial" aria-label="Historial" aria-busy="true" data-testid="skeleton-historial">
        <header className="ficha__cabecera">
          <div className="ficha__titulos">
            <h1>Historial</h1>
          </div>
        </header>
        <span className="sr-only">Cargando…</span>
        <div className="resumen-skeleton__cabecera" aria-hidden="true" />
        <div className="resumen-skeleton__tarjeta" aria-hidden="true" />
      </section>
    );
  }

  const filtroActivo = FILTROS.find((f) => f.clave === tipo) ?? FILTROS[0]!;
  const tipoActivo = filtroActivo.clave === null ? null : tipoDesdeFiltro(filtroActivo.clave);
  const filtrados = tipoActivo === null ? eventos : eventos.filter((e) => e.tipo === tipoActivo);
  const grupos = agrupar(filtrados);

  return (
    <section className="historial" aria-label="Historial">
      <header className="ficha__cabecera">
        <div className="ficha__titulos">
          <h1>Historial</h1>
        </div>
      </header>

      <div className="historial__filtros" role="group" aria-label="Filtrar historial">
        {FILTROS.map((f) => (
          <button
            key={f.etiqueta}
            type="button"
            className="filtro"
            aria-pressed={f.clave === filtroActivo.clave}
            onClick={() => cambiarFiltro(f.clave)}
          >
            {f.etiqueta}
          </button>
        ))}
      </div>

      {grupos.length === 0 ? (
        <p className="historial__vacio">No hay eventos de este tipo.</p>
      ) : (
        <div className="tarjeta historial__tarjeta">
          <Timeline grupos={grupos} menteeId={id ?? ''} />
        </div>
      )}
    </section>
  );
}

/** Agrupa los eventos (ya en orden descendente) por etiqueta de mes/año. */
function agrupar(eventos: EventoHistorial[]): GrupoHistorial[] {
  const anioActual = new Date().getUTCFullYear();
  const grupos: GrupoHistorial[] = [];
  for (const evento of eventos) {
    const etiqueta = etiquetaGrupoHistorial(evento.fecha, anioActual);
    const ultimo = grupos[grupos.length - 1];
    if (ultimo !== undefined && ultimo.etiqueta === etiqueta) {
      ultimo.eventos.push(evento);
    } else {
      grupos.push({ etiqueta, datetime: isoGrupoHistorial(evento.fecha, anioActual), eventos: [evento] });
    }
  }
  return grupos;
}

/** Timeline agrupado (accesibilidad.md §Timeline): `<ol>` con un `<li>` por grupo
 *  y encabezado de mes/año; cada evento es un `<li>` del `<ol>` interno. */
function Timeline({ grupos, menteeId }: { grupos: GrupoHistorial[]; menteeId: string }) {
  return (
    <ol className="timeline">
      {grupos.map((grupo) => (
        <li className="timeline__grupo" key={grupo.etiqueta}>
          <h2 className="timeline__mes">
            <time dateTime={grupo.datetime}>{grupo.etiqueta}</time>
          </h2>
          <ol className="timeline__eventos">
            {grupo.eventos.map((evento) => (
              <Evento key={evento.id} evento={evento} menteeId={menteeId} />
            ))}
          </ol>
        </li>
      ))}
    </ol>
  );
}

/** Evento del timeline: marcador decorativo (aria-hidden) + título 700 + detalle. */
function Evento({ evento, menteeId }: { evento: EventoHistorial; menteeId: string }) {
  switch (evento.tipo) {
    case '1-to-1':
      return (
        <li className="timeline__evento">
          <span className="timeline__marca timeline__marca--1to1" aria-hidden="true" />
          <div className="timeline__evento-cuerpo">
            <span className="sr-only">1-to-1</span>
            <Link
              className="timeline__evento-titulo timeline__evento-enlace"
              to={`/mentees/${menteeId}/1-to-1s/${evento.id}`}
            >
              {evento.temasConNota} {evento.temasConNota === 1 ? 'tema' : 'temas'} ·{' '}
              {evento.acuerdos} {evento.acuerdos === 1 ? 'acuerdo' : 'acuerdos'}
              {evento.inicioNota !== null && <> · «{evento.inicioNota}…»</>}
            </Link>
          </div>
        </li>
      );
    case 'incidencia':
      return (
        <li className="timeline__evento">
          <span
            className={
              evento.estado === 'abierta'
                ? 'timeline__marca timeline__marca--incidencia-abierta'
                : 'timeline__marca timeline__marca--incidencia-resuelta'
            }
            aria-hidden="true"
          />
          <div className="timeline__evento-cuerpo">
            <span className="timeline__evento-titulo">Incidencia</span>
            <span className={`badge ${evento.estado === 'abierta' ? 'badge--abierta' : 'badge--resuelta'}`}>
              {evento.estado === 'abierta' ? 'Abierta' : 'Resuelta'}
            </span>
            <span className="timeline__evento-detalle">{evento.descripcion}</span>
          </div>
        </li>
      );
    case 'objetivo':
      return (
        <li className="timeline__evento">
          <span
            className={
              evento.estado === 'cumplido'
                ? 'timeline__marca timeline__marca--objetivo timeline__marca--objetivo--cumplido'
                : 'timeline__marca timeline__marca--objetivo timeline__marca--objetivo--no-cumplido'
            }
            aria-hidden="true"
          />
          <div className="timeline__evento-cuerpo">
            <span className="sr-only">Objetivo {evento.estado}</span>
            <span className={`badge ${evento.estado === 'cumplido' ? 'badge--cumplido' : 'badge--no-cumplido'}`}>
              {evento.estado === 'cumplido' ? 'Cumplido' : 'No cumplido'}
            </span>
            <span className="timeline__evento-titulo">{evento.titulo}</span>
          </div>
        </li>
      );
    case 'proyecto':
      return (
        <li className="timeline__evento">
          <span
            className={
              evento.direccion === 'entrada'
                ? 'timeline__marca timeline__marca--entra'
                : 'timeline__marca timeline__marca--sale'
            }
            aria-hidden="true"
          />
          <div className="timeline__evento-cuerpo">
            <span className="timeline__evento-titulo">
              {evento.direccion === 'entrada'
                ? `Entra en ${evento.proyecto}`
                : `Sale de ${evento.proyecto}`}
            </span>
            <span className="timeline__evento-detalle">Motivo: {evento.motivo}</span>
          </div>
        </li>
      );
    case 'traspaso':
      return (
        <li className="timeline__evento">
          <span className="timeline__marca timeline__marca--traspaso" aria-hidden="true" />
          <div className="timeline__evento-cuerpo">
            <span className="timeline__evento-titulo">
              Traspaso · {evento.origen} → {evento.destino}
            </span>
            <span className="timeline__evento-detalle">Historial heredado completo</span>
          </div>
        </li>
      );
  }
}