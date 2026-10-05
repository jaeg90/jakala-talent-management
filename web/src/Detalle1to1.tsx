import { useEffect, useRef, useState } from 'react';
import { Link, useOutletContext, useParams } from 'react-router';
import type { AcuerdoDetalle, OneToOne } from './api';
import { api } from './api';
import { fechaConDiaSemana, fechaExacta, fechaISO, hoyISO } from './lib/fechas';

/**
 * Detalle de un 1-to-1 registrado (spec §11a): versión de lectura de Registrar
 * 1-to-1 — cabecera con su fila meta, tarjeta Temas tal como se registró y
 * tarjeta Acuerdos con cumplimiento siempre disponible. La edición en plazo
 * («Editado el …», «Editar 1-to-1», «Cambios») llega con #35.
 *
 * `Detalle1to1` resuelve los parámetros de la URL y monta el contenido con una
 * `key` por 1-to-1/mentee: la key descarta el estado cargado del anterior en el
 * render del cambio (no en el efecto), de modo que al cambiar de mentee o de
 * 1-to-1 nunca se pinta el detalle anterior bajo la URL nueva (regla de #31:
 * «Lo pintado tras la navegación es de los parámetros nuevos»).
 */
export function Detalle1to1() {
  const { id, unoAUnoId } = useParams();
  const { nombre } = useOutletContext<{ nombre: string }>();
  return <Detalle1to1Contenido key={`${id}/${unoAUnoId}`} id={id} unoAUnoId={unoAUnoId} nombre={nombre} />;
}

function Detalle1to1Contenido({
  id,
  unoAUnoId,
  nombre,
}: {
  id: string | undefined;
  unoAUnoId: string | undefined;
  nombre: string;
}) {
  const [unoAUno, setUnoAUno] = useState<OneToOne | null>(null);
  const [nombres, setNombres] = useState<Map<string, string> | null>(null);
  const [noExiste, setNoExiste] = useState(false);
  const [error, setError] = useState(false);
  const [skeleton, setSkeleton] = useState(false);
  // Acuerdos cumplidos en esta vista (id → fecha de cumplimiento), como en el
  // Resumen: el checkbox queda `disabled` y se anuncia «Cumplido».
  const [cumplidos, setCumplidos] = useState<Map<string, string>>(new Map());
  const [anuncio, setAnuncio] = useState('');
  const [errorGuardado, setErrorGuardado] = useState(false);
  const solicitudRef = useRef(0);
  // Destino de foco tras marcar cumplido: los botones «Marcar cumplido» de cada
  // acuerdo pendiente (por id) y la etiqueta de la tarjeta de acuerdos (lista vacía).
  const accionRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const tituloAcuerdosRef = useRef<HTMLHeadingElement | null>(null);

  // Vista local de los acuerdos: los ya cumplidos conservan su fecha de cumplimiento
  // persistida (o null si es un cumplido histórico sin fecha), y los cumplidos en
  // esta sesión la toman de hoy (misma convención UTC del servidor).
  function acuerdosVisibles(): AcuerdoDetalle[] {
    if (unoAUno === null) return [];
    return unoAUno.acuerdos.map((a): AcuerdoDetalle => {
      if (a.done) return a;
      const fecha = cumplidos.get(a.id);
      return fecha !== undefined ? { ...a, done: true, cumplidoEl: fecha } : a;
    });
  }

  function cargar() {
    if (id === undefined || unoAUnoId === undefined) return;
    const solicitud = ++solicitudRef.current;
    setError(false);
    setNoExiste(false);
    setUnoAUno(null);
    setNombres(null);
    setCumplidos(new Map());
    setAnuncio('');
    setErrorGuardado(false);
    setSkeleton(false);
    // P4 (§Estados «Cargando»): skeleton solo si la carga tarda más de 300 ms.
    const inicio = Date.now();
    const reloj = window.setTimeout(() => {
      if (solicitud !== solicitudRef.current) return;
      if (Date.now() - inicio > 300) setSkeleton(true);
    }, 300);
    Promise.all([api.oneToOne(id, unoAUnoId), api.managers()])
      .then(([unoAUnoResp, censo]) => {
        if (solicitud !== solicitudRef.current) return;
        window.clearTimeout(reloj);
        if (unoAUnoResp === null) {
          setNoExiste(true);
          return;
        }
        setUnoAUno(unoAUnoResp);
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
  }, [id, unoAUnoId]);

  async function marcarCumplido(acuerdo: AcuerdoDetalle) {
    // El token de la vista vigente: si la petición termina después de navegar a otro
    // 1-to-1/mentee, su respuesta no debe tocar el estado de la vista nueva.
    const solicitud = solicitudRef.current;
    setErrorGuardado(false);
    try {
      await api.completeAgreement(acuerdo.id);
      if (solicitud !== solicitudRef.current) return;
      // Destino de foco: el siguiente acuerdo que quede pendiente; si no, el
      // anterior; si no queda ninguno, la etiqueta de la tarjeta de acuerdos.
      const pendientes = acuerdosVisibles()
        .filter((a) => !a.done)
        .map((a) => a.id);
      const indice = pendientes.indexOf(acuerdo.id);
      let destinoId: string | null = null;
      if (indice >= 0) {
        const siguiente = pendientes[indice + 1];
        const anterior = pendientes[indice - 1];
        destinoId = siguiente ?? anterior ?? null;
      }
      setAnuncio('Cumplido');
      setCumplidos((actual) => new Map(actual).set(acuerdo.id, hoyISO()));
      // Tras el re-render que sustituye el control que disparó la acción (checkbox
      // o «Marcar cumplido»), el foco va a un destino explícito y no cae al <body>.
      window.setTimeout(() => {
        if (solicitud !== solicitudRef.current) return;
        if (destinoId !== null) accionRefs.current[destinoId]?.focus();
        else tituloAcuerdosRef.current?.focus();
      }, 0);
    } catch {
      if (solicitud !== solicitudRef.current) return;
      setErrorGuardado(true);
    }
  }

  if (error) {
    return (
      <section className="detalle-1to1" aria-label="1-to-1s">
        <Volver id={id ?? ''} />
        <div className="estado" role="alert">
          <p className="estado__mensaje">No hemos podido cargar este 1-to-1. Revisa tu conexión.</p>
          <button className="boton boton--secundario" type="button" onClick={cargar}>
            Reintentar
          </button>
        </div>
      </section>
    );
  }

  if (noExiste) {
    return (
      <section className="detalle-1to1" aria-label="1-to-1s">
        <Volver id={id ?? ''} />
        <div className="detalle-1to1__estado">
          <p className="detalle-1to1__estado-mensaje">
            Este 1-to-1 no existe o no es de {nombre}.
          </p>
          <Link className="accion" to={`/mentees/${id}/1-to-1s`}>
            Ver sus 1-to-1s
          </Link>
        </div>
      </section>
    );
  }

  if (unoAUno === null || nombres === null) {
    if (!skeleton) return null;
    return (
      <section className="detalle-1to1" aria-label="1-to-1s" aria-busy="true" data-testid="skeleton-detalle-1to1">
        <span className="sr-only">Cargando…</span>
        <div className="detalle-1to1__skeleton-volver" aria-hidden="true" />
        <div className="detalle-1to1__skeleton-cabecera" aria-hidden="true" />
        <div className="detalle-1to1__skeleton-tarjeta" aria-hidden="true" />
        <div className="detalle-1to1__skeleton-tarjeta" aria-hidden="true" />
      </section>
    );
  }

  const registrador = nombres.get(unoAUno.registradoPor);
  const acuerdos = acuerdosVisibles();
  const pendientes = acuerdos.filter((a) => !a.done);
  const etiquetaAcuerdos =
    acuerdos.length === 0
      ? 'Acuerdos'
      : pendientes.length === 0
        ? 'Acuerdos · todos cumplidos'
        : `Acuerdos · ${pendientes.length} ${pendientes.length === 1 ? 'pendiente' : 'pendientes'}`;

  return (
    <section className="detalle-1to1" aria-label="1-to-1s">
      {/* Anuncio «Cumplido» en una región `role="status"` estable (accesibilidad.md
         §Checkbox de acuerdo), fuera de la tarjeta que cambia al cumplir. */}
      <span className="sr-only" role="status">{anuncio}</span>

      <Volver id={id ?? ''} />

      <header>
        <div className="detalle-1to1__titulos">
          <h1>1-to-1 del {fechaExacta(unoAUno.date)}</h1>
          <p className="detalle-1to1__meta">
            <time className="detalle-1to1__meta-item" dateTime={fechaISO(unoAUno.date)}>
              {fechaConDiaSemana(unoAUno.date)}
            </time>
            <span className="detalle-1to1__meta-sep" aria-hidden="true">·</span>
            {registrador !== undefined && (
              <span className="detalle-1to1__meta-item">Registrado por {registrador}</span>
            )}
          </p>
        </div>
      </header>

      {errorGuardado && (
        <div className="aviso aviso--error" role="alert">
          No se ha podido guardar. Inténtalo de nuevo.
        </div>
      )}

      <section className="tarjeta detalle-1to1__tarjeta detalle-1to1__tarjeta--temas" aria-label="Temas">
        <h2 className="detalle-1to1__etiqueta">Temas</h2>
        {unoAUno.notas.map((n) => (
          <div className="detalle-1to1__tema" key={n.tema}>
            <h2 className="detalle-1to1__pregunta">
              {n.tema}
              {n.propio && <span className="chip detalle-1to1__chip">propio</span>}
            </h2>
            {n.nota.trim() === '' ? (
              <p className="detalle-1to1__sin-nota">Sin nota.</p>
            ) : (
              <p className="detalle-1to1__nota">{n.nota}</p>
            )}
          </div>
        ))}
      </section>

      <section className="tarjeta detalle-1to1__tarjeta detalle-1to1__tarjeta--acuerdos" aria-label="Acuerdos">
        <h2 className="detalle-1to1__etiqueta" ref={tituloAcuerdosRef} tabIndex={-1}>
          {etiquetaAcuerdos}
        </h2>
        {acuerdos.length === 0 ? (
          <p className="detalle-1to1__vacio">En este 1-to-1 no se acordó nada.</p>
        ) : (
          <ul className="detalle-1to1__acuerdos">
            {acuerdos.map((a) =>
              a.done ? (
                <li key={a.id} className="detalle-1to1__acuerdo detalle-1to1__acuerdo--cumplido">
                  <label className="check">
                    <input type="checkbox" checked disabled />
                    <span className="detalle-1to1__acuerdo-texto detalle-1to1__tachado">{a.text}</span>
                  </label>
                  <span className="badge badge--cumplido">
                    {a.cumplidoEl !== null ? `Cumplido · ${fechaExacta(a.cumplidoEl)}` : 'Cumplido'}
                  </span>
                </li>
              ) : (
                <li key={a.id} className="detalle-1to1__acuerdo">
                  <label className="check">
                    <input type="checkbox" checked={false} onChange={() => void marcarCumplido(a)} />
                    <span className="detalle-1to1__acuerdo-texto" id={`acuerdo-${a.id}`}>{a.text}</span>
                  </label>
                  <button
                    className="accion detalle-1to1__marcar"
                    type="button"
                    aria-label={`Marcar cumplido: ${a.text}`}
                    aria-describedby={`acuerdo-${a.id}`}
                    ref={(el) => {
                      accionRefs.current[a.id] = el;
                    }}
                    onClick={() => void marcarCumplido(a)}
                  >
                    Marcar cumplido
                  </button>
                </li>
              ),
            )}
          </ul>
        )}
      </section>
    </section>
  );
}

function Volver({ id }: { id: string }) {
  // «← 1-to-1s» reutiliza el enlace de vuelta de la ficha: mismo estilo 14px
  // secundario, foco visible y objetivo táctil (espec §Esqueletos / §11a).
  return (
    <Link className="ficha__volver" to={`/mentees/${id}/1-to-1s`}>
      ← 1-to-1s
    </Link>
  );
}