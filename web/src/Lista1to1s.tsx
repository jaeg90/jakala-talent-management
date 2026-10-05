import { Fragment, useEffect, useId, useRef, useState, type RefObject } from 'react';
import { Link, useOutletContext, useParams } from 'react-router';
import type { OneToOne } from './api';
import { api } from './api';
import { useAuth } from './auth';
import { fechaExacta, fechaISO, fechaRelativa } from './lib/fechas';

/**
 * Lista de 1-to-1s de la ficha (spec §10): lista completa, sin paginación,
 * agrupada por año (descendente), con búsqueda en notas y acuerdos (debounce,
 * sin mayúsculas ni tildes, en cliente). Sustituye al puente temporal (ADR-0011).
 */

/* — Búsqueda de texto sin mayúsculas ni tildes — */

/** Clave de comparación: minúsculas y sin tildes (spec §10 «sin distinguir
 *  mayúsculas ni tildes»; misma normalización que el dominio de temas, §14). */
function normalizar(texto: string): string {
  return texto.normalize('NFD').replace(/\p{M}/gu, '').toLocaleLowerCase('es');
}

/**
 * Índice (en unidades UTF-16 del texto original) del carácter que produce cada
 * carácter del texto normalizado. Permite ubicar en el original un tramo hallado
 * en el normalizado (la normalización contrae las tildes: «ñ» pesa un carácter
 * en ambos, pero las vocales con tilde se descomponen en dos antes de quitar la
 * marca). Avanza por unidades de código, suficiente para el texto del dominio
 * (sin emojis ni pares sustitutos).
 */
function mapaNormalizado(texto: string): number[] {
  const mapa: number[] = [];
  for (let i = 0; i < texto.length; i++) {
    const producidos = normalizar(texto[i]!).length;
    for (let k = 0; k < producidos; k++) mapa.push(i);
  }
  return mapa;
}

/** Todas las coincidencias de `consulta` en `texto`, ya en índices originales. */
function buscarCoincidencias(texto: string, consulta: string): { inicio: number; fin: number }[] {
  const norm = normalizar(texto);
  const q = normalizar(consulta);
  if (q === '') return [];
  const mapa = mapaNormalizado(texto);
  const halladas: { inicio: number; fin: number }[] = [];
  let desde = 0;
  while (desde <= norm.length - q.length) {
    const idx = norm.indexOf(q, desde);
    if (idx === -1) break;
    const finNorm = idx + q.length;
    const inicio = mapa[idx] ?? 0;
    const fin = finNorm < norm.length ? (mapa[finNorm] ?? texto.length) : texto.length;
    halladas.push({ inicio, fin });
    desde = finNorm;
  }
  return halladas;
}

/** Resultado de buscar en un 1-to-1: la primera coincidencia y el total. */
interface Coincidencia {
  donde: string;
  texto: string;
  inicio: number;
  fin: number;
  total: number;
}

/** Busca `consulta` en las notas (por su texto) y los acuerdos del 1-to-1. */
function coincidenciasDe(unoAUno: OneToOne, consulta: string): Coincidencia | null {
  const todas: { donde: string; texto: string; inicio: number; fin: number }[] = [];
  for (const n of unoAUno.notas) {
    for (const c of buscarCoincidencias(n.nota, consulta)) {
      todas.push({ donde: `En «${n.tema}»`, texto: n.nota, inicio: c.inicio, fin: c.fin });
    }
  }
  for (const a of unoAUno.acuerdos) {
    for (const c of buscarCoincidencias(a.text, consulta)) {
      todas.push({ donde: 'En un acuerdo', texto: a.text, inicio: c.inicio, fin: c.fin });
    }
  }
  if (todas.length === 0) return null;
  const primera = todas[0]!;
  return { donde: primera.donde, texto: primera.texto, inicio: primera.inicio, fin: primera.fin, total: todas.length };
}

/** «En «tema»» / «En un acuerdo», con « · y n más» si hay varias coincidencias. */
function dondeCoincide(c: Coincidencia): string {
  return c.total > 1 ? `${c.donde} · y ${c.total - 1} más` : c.donde;
}

/** Fragmento de ~60 caracteres de contexto a cada lado (spec §10). */
function fragmento(texto: string, inicio: number, fin: number): {
  pre: string;
  hit: string;
  post: string;
  cortePre: boolean;
  cortePost: boolean;
} {
  const margen = 60;
  const pre = texto.slice(Math.max(0, inicio - margen), inicio);
  const hit = texto.slice(inicio, fin);
  const post = texto.slice(fin, fin + margen);
  return { pre, hit, post, cortePre: inicio - margen > 0, cortePost: fin + margen < texto.length };
}

/* — Etiquetas de fila — */

/** «n temas con nota», singular incluido. */
function temasTexto(n: number): string {
  return `${n} ${n === 1 ? 'tema con nota' : 'temas con nota'}`;
}

/** Resumen de acuerdos para el nombre accesible («2 acuerdos pendientes», etc.). */
function acuerdosTexto(pendientes: number, cumplidos: number): string {
  const partes: string[] = [];
  if (pendientes > 0) partes.push(`${pendientes} ${pendientes === 1 ? 'acuerdo pendiente' : 'acuerdos pendientes'}`);
  if (cumplidos > 0) partes.push(`${cumplidos} ${cumplidos === 1 ? 'acuerdo cumplido' : 'acuerdos cumplidos'}`);
  return partes.length === 0 ? 'sin acuerdos' : partes.join(', ');
}

/** Agrupa la lista (ya en orden descendente) por año, con su contador. */
function agruparPorAnio(lista: OneToOne[]): { anio: number; onetoones: OneToOne[] }[] {
  const grupos: { anio: number; onetoones: OneToOne[] }[] = [];
  for (const o of lista) {
    const anio = Number(o.date.slice(0, 4));
    const ultimo = grupos[grupos.length - 1];
    if (ultimo !== undefined && ultimo.anio === anio) ultimo.onetoones.push(o);
    else grupos.push({ anio, onetoones: [o] });
  }
  return grupos;
}

export function Lista1to1s() {
  const { id } = useParams();
  const { manager } = useAuth();
  // El nombre de la mentee lo resuelve el ShellFicha (junto al sidebar) y lo
  // entrega por el Outlet context: así el buscador conserva su nombre accesible
  // completo («Buscar en los 1-to-1s de {nombre}») también durante el skeleton.
  const { nombre } = useOutletContext<{ nombre: string }>();
  const [onetoones, setOnetoones] = useState<OneToOne[] | null>(null);
  const [nombres, setNombres] = useState<Map<string, string> | null>(null);
  const [error, setError] = useState(false);
  const [skeleton, setSkeleton] = useState(false);
  const solicitudRef = useRef(0);

  const [texto, setTexto] = useState('');
  const [consulta, setConsulta] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);
  const inputId = useId();

  function cargar() {
    if (id === undefined) return;
    const solicitud = ++solicitudRef.current;
    setError(false);
    setOnetoones(null);
    setNombres(null);
    setSkeleton(false);
    setTexto('');
    setConsulta('');
    // P4 (§Estados «Cargando»): skeleton solo si la carga tarda más de 300 ms.
    const inicio = Date.now();
    const reloj = window.setTimeout(() => {
      if (solicitud !== solicitudRef.current) return;
      if (Date.now() - inicio > 300) setSkeleton(true);
    }, 300);
    Promise.all([api.ficha(id), api.managers()])
      .then(([ficha, censo]) => {
        if (solicitud !== solicitudRef.current) return;
        window.clearTimeout(reloj);
        setOnetoones(ficha.history);
        setNombres(new Map(censo.managers.map((m) => [m.id, m.name])));
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

  // Debounce 250 ms; mínimo 2 caracteres (spec §10). El filtrado se aplica sobre
  // `consulta` (ya recortada), no sobre el campo a cada pulsación.
  useEffect(() => {
    const valor = texto.trim();
    if (valor.length < 2) {
      setConsulta('');
      return;
    }
    const reloj = window.setTimeout(() => setConsulta(valor), 250);
    return () => window.clearTimeout(reloj);
  }, [texto]);

  function borrarBusqueda() {
    setTexto('');
    setConsulta('');
    inputRef.current?.focus();
  }

  /** Nombre del manager que lo registró, solo si no es el actual (traspaso). */
  function nombreRegistrador(unoAUno: OneToOne): string | null {
    const managerId = manager?.id;
    if (managerId === undefined || unoAUno.registradoPor === managerId) return null;
    return nombres?.get(unoAUno.registradoPor) ?? null;
  }

  if (error) {
    return (
      <section className="lista1to1" aria-label="1-to-1s">
        <Cabecera contador={null} id={id ?? ''} />
        <div className="estado" role="alert">
          <p className="estado__mensaje">No hemos podido cargar los 1-to-1s. Revisa tu conexión.</p>
          <button className="boton boton--secundario" type="button" onClick={cargar}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (onetoones === null || nombres === null) {
    if (!skeleton) return null;
    return (
      <section className="lista1to1" aria-label="1-to-1s" aria-busy="true" data-testid="skeleton-lista-1to1s">
        <Cabecera contador={null} id={id ?? ''} />
        <Buscador id={inputId} label={`Buscar en los 1-to-1s de ${primerNombre(nombre)}`} disabled />
        <div className="tarjeta lista__tarjeta">
          <span className="sr-only">Cargando…</span>
          <div className="lista__esqueleto" aria-hidden="true">
            {Array.from({ length: 6 }, (_, i) => (
              <div className="lista__skeleton-fila" key={i} />
            ))}
          </div>
        </div>
      </section>
    );
  }

  // La API devuelve el historial en orden ascendente; la lista se pinta descendente.
  const descendente = [...onetoones].reverse();
  const total = onetoones.length;
  const ultimo = descendente[0] ?? null;

  const hayBusqueda = consulta !== '';
  const resultados = hayBusqueda
    ? descendente.flatMap((o) => {
        const c = coincidenciasDe(o, consulta);
        return c === null ? [] : [{ unoAUno: o, coincidencia: c }];
      })
    : null;

  return (
    <section className="lista1to1" aria-label="1-to-1s">
      <Cabecera contador={ultimo !== null ? { total, relativa: fechaRelativa(ultimo.date), iso: fechaISO(ultimo.date) } : null} id={id ?? ''} />

      <Buscador
        id={inputId}
        label={`Buscar en los 1-to-1s de ${primerNombre(nombre)}`}
        value={texto}
        onChange={setTexto}
        onBorrar={borrarBusqueda}
        inputRef={inputRef}
      />

      {hayBusqueda ? (
        resultados!.length === 0 ? (
          <div className="lista1to1__sin-resultados">
            <p aria-live="polite">Ningún 1-to-1 contiene «{consulta}».</p>
            <button className="accion" type="button" onClick={borrarBusqueda}>
              Borrar búsqueda
            </button>
          </div>
        ) : (
          <>
            <p className="lista__contador" aria-live="polite">
              {resultados!.length === 1
                ? `1 1-to-1 contiene «${consulta}»`
                : `${resultados!.length} 1-to-1s contienen «${consulta}»`}
            </p>
            <div className="tarjeta lista__tarjeta">
              <ol className="lista__filas">
                {resultados!.map(({ unoAUno, coincidencia }) => (
                  <li key={unoAUno.id}>
                    <FilaUnoAUno
                      id={id ?? ''}
                      unoAUno={unoAUno}
                      nombreRegistrador={nombreRegistrador(unoAUno)}
                      coincidencia={coincidencia}
                    />
                  </li>
                ))}
              </ol>
            </div>
          </>
        )
      ) : total === 0 ? (
        <div className="lista1to1__vacio">
          <p className="lista1to1__vacio-texto">
            Aún no habéis tenido ningún 1-to-1. Regístralo al terminar la conversación para seguir sus acuerdos.
          </p>
          <Link className="boton boton--secundario" to={`/mentees/${id}/1-to-1s/nuevo`}>
            Registrar 1-to-1
          </Link>
        </div>
      ) : (
        <div className="tarjeta lista__tarjeta">
          {agruparPorAnio(descendente).map((grupo) => (
            <Fragment key={grupo.anio}>
              <h2 className="lista__grupo">
                <time dateTime={`${grupo.anio}-01-01`}>{grupo.anio}</time>
                <span aria-hidden="true"> · {grupo.onetoones.length}</span>
              </h2>
              <ol className="lista__filas">
                {grupo.onetoones.map((o) => (
                  <li key={o.id}>
                    <FilaUnoAUno id={id ?? ''} unoAUno={o} nombreRegistrador={nombreRegistrador(o)} coincidencia={null} />
                  </li>
                ))}
              </ol>
            </Fragment>
          ))}
        </div>
      )}
    </section>
  );
}

/** Cabecera de sección: título + subtítulo («n 1-to-1s · el último, hace …») + botón. */
function Cabecera({
  contador,
  id,
}: {
  contador: { total: number; relativa: string; iso: string } | null;
  id: string;
}) {
  return (
    <header className="ficha__cabecera">
      <div className="ficha__titulos">
        <h1>1-to-1s</h1>
        {contador !== null && (
          <p className="ficha__subtitulo">
            {contador.total === 1 ? '1 1-to-1 · ' : `${contador.total} 1-to-1s · el último, `}
            <time dateTime={contador.iso}>{contador.relativa}</time>
          </p>
        )}
      </div>
      <Link className="boton boton--primario" to={`/mentees/${id}/1-to-1s/nuevo`}>
        Registrar 1-to-1
      </Link>
    </header>
  );
}

/** Buscador (componentes.md §Buscador): campo + «Borrar búsqueda» solo con texto. */
function Buscador({
  id,
  label,
  value,
  onChange,
  onBorrar,
  inputRef,
  disabled,
}: {
  id: string;
  label: string;
  value?: string;
  onChange?: (value: string) => void;
  onBorrar?: () => void;
  inputRef?: RefObject<HTMLInputElement | null>;
  disabled?: boolean;
}) {
  const hayTexto = (value ?? '').trim() !== '';
  return (
    <search className="buscador" role="search">
      <label className="sr-only" htmlFor={id}>
        {label}
      </label>
      <input
        ref={inputRef}
        id={id}
        className="buscador__campo"
        type="search"
        placeholder="Buscar en notas y acuerdos"
        value={value ?? ''}
        disabled={disabled === true}
        onChange={(e) => onChange?.(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Escape' && onBorrar !== undefined) {
            e.preventDefault();
            onBorrar();
          }
        }}
      />
      {!disabled && hayTexto && onBorrar !== undefined && (
        <button className="accion buscador__borrar" type="button" onClick={onBorrar}>
          Borrar búsqueda
        </button>
      )}
    </search>
  );
}

/** Fila de la lista (enlace al detalle #31, toda clicable; spec §10). */
function FilaUnoAUno({
  id,
  unoAUno,
  nombreRegistrador,
  coincidencia,
}: {
  id: string;
  unoAUno: OneToOne;
  nombreRegistrador: string | null;
  coincidencia: Coincidencia | null;
}) {
  const fecha = fechaExacta(unoAUno.date);
  const relativa = fechaRelativa(unoAUno.date);
  const temasConNota = unoAUno.notas.filter((n) => n.nota.trim() !== '').length;
  const cita = unoAUno.notas.map((n) => n.nota).find((n) => n.trim() !== '') ?? null;
  const pendientes = unoAUno.acuerdos.filter((a) => !a.done).length;
  const cumplidos = unoAUno.acuerdos.filter((a) => a.done).length;
  const frag = coincidencia !== null ? fragmento(coincidencia.texto, coincidencia.inicio, coincidencia.fin) : null;

  const base = `1-to-1 del ${fecha}, ${relativa}, ${temasTexto(temasConNota)}, ${acuerdosTexto(pendientes, cumplidos)}`;
  const registro = nombreRegistrador !== null ? `, registrado por ${nombreRegistrador}` : '';
  const donde = coincidencia !== null ? `, ${dondeCoincide(coincidencia)}` : '';
  const ariaLabel = `${base}${registro}${donde}`;

  return (
    <Link
      className={coincidencia !== null ? 'fila-1to1 fila-1to1--busqueda' : 'fila-1to1'}
      to={`/mentees/${id}/1-to-1s/${unoAUno.id}`}
      aria-label={ariaLabel}
    >
      <div className="fila-1to1__fecha">
        <time dateTime={fechaISO(unoAUno.date)}>{fecha}</time>
        <span className="fila-1to1__relativa">{relativa}</span>
      </div>

      {coincidencia !== null && frag !== null ? (
        <div className="fila-1to1__cuerpo">
          <span className="fila-1to1__donde">{dondeCoincide(coincidencia)}</span>
          <p className="fila-1to1__fragmento">
            {frag.cortePre && '…'}
            {frag.pre}
            <mark className="coincidencia">{frag.hit}</mark>
            {frag.post}
            {frag.cortePost && '…'}
          </p>
          <span className="fila-1to1__meta">
            {temasTexto(temasConNota)}
            {nombreRegistrador !== null && <> · Registrado por {nombreRegistrador}</>}
          </span>
        </div>
      ) : (
        <div className="fila-1to1__cuerpo">
          <span className="fila-1to1__cita">{cita !== null ? `«${cita}»` : 'Sin notas'}</span>
          <span className="fila-1to1__meta">
            {temasTexto(temasConNota)}
            {nombreRegistrador !== null && <> · Registrado por {nombreRegistrador}</>}
          </span>
        </div>
      )}

      <div className="fila-1to1__acuerdos">
        {pendientes > 0 && (
          <span className="badge badge--en-curso">
            {pendientes} {pendientes === 1 ? 'pendiente' : 'pendientes'}
          </span>
        )}
        {cumplidos > 0 && (
          <span className="badge badge--cumplido">
            {cumplidos} {cumplidos === 1 ? 'cumplido' : 'cumplidos'}
          </span>
        )}
        {pendientes === 0 && cumplidos === 0 && (
          <span className="guion" aria-label="ninguno">
            —
          </span>
        )}
      </div>
    </Link>
  );
}

/** Primer nombre de una persona («Ana Alonso» → «Ana»), para la etiqueta del buscador. */
function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}