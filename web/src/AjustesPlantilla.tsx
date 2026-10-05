import { useEffect, useId, useRef, useState } from 'react';
import { api, type TemaPlantilla } from './api';
import { DialogoConfirmacion } from './RegistrarUnoAUno';

/**
 * Ajustes · Plantilla de 1-to-1 (spec §Ajustes · 3d, captura 09c): gestión de la
 * plantilla del manager autenticado — añadir, editar en línea, reordenar con
 * anuncio de posición, retirar, volver a usar y restablecer — consumiendo la
 * API de #15. Editar la plantilla solo afecta a los siguientes 1-to-1s: los ya
 * registrados no cambian (el formulario de registro consume esta plantilla).
 */

/** Regla de dominio de #15: el texto de un tema, recortado, no puede estar vacío. */
const TEXTO_VACIO = 'El texto del tema no puede estar vacío';

/** Copy P4 de error al guardar (spec §Estados). */
const ERROR_GUARDADO = 'No se ha podido guardar. Inténtalo de nuevo.';

export function AjustesPlantilla() {
  const [temas, setTemas] = useState<TemaPlantilla[]>([]);
  const [cargando, setCargando] = useState(true);
  const [skeleton, setSkeleton] = useState(false);
  const [errorCarga, setErrorCarga] = useState(false);
  const [intento, setIntento] = useState(0);

  // Edición en línea: la fila del tema editado se sustituye por input + acciones.
  const [editando, setEditando] = useState<string | null>(null);
  const [borrador, setBorrador] = useState('');
  const [errorEdicion, setErrorEdicion] = useState<string | null>(null);

  // Alta en la tarjeta «Añadir tema genérico».
  const [nombre, setNombre] = useState('');
  const [errorAlta, setErrorAlta] = useState<string | null>(null);
  const [errorGuardadoAlta, setErrorGuardadoAlta] = useState(false);

  // Fallo de una operación de fila (mover, retirar, volver a usar) y del resto.
  const [errorOperacion, setErrorOperacion] = useState(false);
  const [enviando, setEnviando] = useState<string | null>(null);
  // Reordenación en curso: qué tema y en qué sentido, para el gerundio del botón
  // (P4 §Estados «Enviando»): mientras se mueve, el ↑/↓ queda con «Moviendo …».
  const [moviendo, setMoviendo] = useState<{ id: string; delta: -1 | 1 } | null>(null);

  // Restablecimiento con confirmación (alertdialog reutilizado de §04).
  const [restablecerAbierto, setRestablecerAbierto] = useState(false);
  const [errorRestablecer, setErrorRestablecer] = useState(false);

  // Región única de anuncios en `aria-live` (accesibilidad.md §Reordenar temas:
  // tras mover, la posición; en las demás operaciones, el resultado).
  const [aviso, setAviso] = useState('');

  const activo = useRef(true);
  const focoPendiente = useRef<(() => void) | null>(null);
  const nombreRef = useRef<HTMLInputElement>(null);
  const restablecerRef = useRef<HTMLButtonElement>(null);
  const botonMoverRef = useRef<HTMLButtonElement | null>(null);
  const editarRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const retirarRefs = useRef<Record<string, HTMLButtonElement | null>>({});
  const usarRefs = useRef<Record<string, HTMLButtonElement | null>>({});
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
    api.plantilla().then(({ temas: lista }) => {
      if (vigente) setTemas(lista);
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

  // Tras cada respuesta, enfoca un destino que siga existiendo (el botón pulsado,
  // el siguiente de la lista o el campo de alta): nunca se pierde el foco.
  useEffect(() => {
    focoPendiente.current?.();
    focoPendiente.current = null;
  }, [temas, editando, restablecerAbierto]);

  const vigentes = temas.filter((t) => t.estado === 'vigente').sort((a, b) => a.orden - b.orden);
  const retirados = temas.filter((t) => t.estado === 'retirado').sort((a, b) => a.orden - b.orden);
  const bloqueado = cargando || errorCarga || enviando !== null;

  /** Copia del error para el campo: el duplicado es mensaje de dominio; lo demás, genérico. */
  function mensaje(err: unknown): string {
    const texto = err instanceof Error ? err.message : '';
    return texto.startsWith('Ya existe el tema') ? texto : ERROR_GUARDADO;
  }

  async function añadir(e: React.FormEvent) {
    e.preventDefault();
    if (bloqueado) return;
    setErrorAlta(null);
    setErrorGuardadoAlta(false);
    const texto = nombre.trim();
    if (texto === '') {
      setErrorAlta(TEXTO_VACIO);
      nombreRef.current?.focus();
      return;
    }
    setEnviando('alta');
    try {
      const creado = await api.addTemaPlantilla(texto);
      if (!activo.current) return;
      setTemas((lista) => [...lista, creado]);
      setNombre('');
      setAviso(`Tema «${creado.tema}» añadido.`);
      focoPendiente.current = () => nombreRef.current?.focus();
    } catch (err) {
      if (!activo.current) return;
      const msg = err instanceof Error ? err.message : '';
      if (msg.startsWith('Ya existe el tema')) {
        setErrorAlta(msg);
        nombreRef.current?.focus();
      } else setErrorGuardadoAlta(true);
    } finally {
      if (activo.current) setEnviando(null);
    }
  }

  function abrirEdicion(t: TemaPlantilla) {
    if (bloqueado) return;
    setBorrador(t.tema);
    setErrorEdicion(null);
    setEditando(t.id);
  }

  function cancelarEdicion(t: TemaPlantilla) {
    if (bloqueado) return;
    focoPendiente.current = () => editarRefs.current[t.id]?.focus();
    setEditando(null);
    setBorrador('');
    setErrorEdicion(null);
  }

  async function guardarEdicion(e: React.FormEvent, t: TemaPlantilla) {
    e.preventDefault();
    if (bloqueado) return;
    setErrorEdicion(null);
    const texto = borrador.trim();
    if (texto === '') {
      setErrorEdicion(TEXTO_VACIO);
      return;
    }
    setEnviando(t.id);
    try {
      const editado = await api.editarTemaPlantilla(t.id, texto);
      if (!activo.current) return;
      setTemas((lista) => lista.map((x) => x.id === editado.id ? editado : x));
      setEditando(null);
      setBorrador('');
      setAviso(`Tema «${editado.tema}» guardado.`);
      focoPendiente.current = () => editarRefs.current[editado.id]?.focus();
    } catch (err) {
      // La edición en línea conserva lo escrito (spec §Estados P4).
      if (activo.current) setErrorEdicion(mensaje(err));
    } finally {
      if (activo.current) setEnviando(null);
    }
  }

  async function mover(t: TemaPlantilla, delta: -1 | 1, enElBorde: boolean, boton: HTMLButtonElement) {
    if (bloqueado || enElBorde) return;
    setEnviando(t.id);
    setMoviendo({ id: t.id, delta });
    setErrorOperacion(false);
    try {
      const { temas: lista } = await api.moverTemaPlantilla(t.id, delta);
      if (!activo.current) return;
      const ordenados = lista.filter((x) => x.estado === 'vigente').sort((a, b) => a.orden - b.orden);
      const destino = ordenados.findIndex((x) => x.id === t.id) + 1;
      setTemas(lista);
      if (destino > 0) setAviso(`${t.tema} movido a la posición ${destino} de ${ordenados.length}.`);
      // El foco permanece en el botón de reordenar que movió el tema.
      botonMoverRef.current = boton;
      focoPendiente.current = () => botonMoverRef.current?.focus();
    } catch {
      if (activo.current) setErrorOperacion(true);
    } finally {
      if (activo.current) { setEnviando(null); setMoviendo(null); }
    }
  }

  async function retirar(t: TemaPlantilla) {
    if (bloqueado || vigentes.length === 1) return;
    const indice = vigentes.findIndex((v) => v.id === t.id);
    setEnviando(t.id);
    setErrorOperacion(false);
    try {
      const retirado = await api.retirarTemaPlantilla(t.id);
      if (!activo.current) return;
      // El servidor reenumera los vigentes restantes en la misma transacción y
      // la respuesta solo devuelve la fila retirada: se replica aquí para que
      // el orden local siga siendo la posición entre los vigentes.
      setTemas((lista) => {
        const restantes = lista
          .filter((x) => x.estado === 'vigente' && x.id !== t.id)
          .sort((a, b) => a.orden - b.orden)
          .map((v, i) => ({ ...v, orden: i }));
        return lista.map((x) => x.id === retirado.id ? retirado : restantes.find((r) => r.id === x.id) ?? x);
      });
      setAviso(`Tema «${retirado.tema}» retirado.`);
      // El foco va al «Retirar» siguiente de los vigentes, o al anterior si era el último.
      const restantes = vigentes.filter((v) => v.id !== t.id);
      const siguiente = restantes[indice] ?? restantes[restantes.length - 1];
      focoPendiente.current = () => (siguiente
        ? retirarRefs.current[siguiente.id]?.focus()
        : nombreRef.current?.focus());
    } catch {
      if (activo.current) setErrorOperacion(true);
    } finally {
      if (activo.current) setEnviando(null);
    }
  }

  async function volverAUsar(t: TemaPlantilla) {
    if (bloqueado) return;
    const indice = retirados.findIndex((r) => r.id === t.id);
    setEnviando(t.id);
    setErrorOperacion(false);
    try {
      const reactivado = await api.reactivarTemaPlantilla(t.id);
      if (!activo.current) return;
      setTemas((lista) => lista.map((x) => x.id === reactivado.id ? reactivado : x));
      setAviso(`Tema «${reactivado.tema}» vuelve a estar en uso.`);
      // El foco va al «Volver a usar» siguiente, o al campo de alta si la lista queda vacía.
      const restantes = retirados.filter((r) => r.id !== t.id);
      const siguiente = restantes[indice] ?? restantes[restantes.length - 1];
      focoPendiente.current = () => (siguiente
        ? usarRefs.current[siguiente.id]?.focus()
        : nombreRef.current?.focus());
    } catch {
      if (activo.current) setErrorOperacion(true);
    } finally {
      if (activo.current) setEnviando(null);
    }
  }

  function pedirRestablecer() {
    if (bloqueado) return;
    setErrorRestablecer(false);
    setRestablecerAbierto(true);
  }

  function cancelarRestablecer() {
    if (enviando === 'restablecer') return;
    focoPendiente.current = () => restablecerRef.current?.focus();
    setRestablecerAbierto(false);
  }

  async function confirmarRestablecer() {
    if (bloqueado) return;
    setEnviando('restablecer');
    setErrorRestablecer(false);
    try {
      const { temas: lista } = await api.restablecerPlantilla();
      if (!activo.current) return;
      setTemas(lista);
      // Una edición en línea abierta deja de ser válida al restablecer: su fila
      // pasa a retirados y, al volver a usarla, no debe reaparecer con el borrador.
      setEditando(null);
      setBorrador('');
      setErrorEdicion(null);
      setRestablecerAbierto(false);
      setAviso('Plantilla restablecida.');
      focoPendiente.current = () => restablecerRef.current?.focus();
    } catch {
      if (activo.current) setErrorRestablecer(true);
    } finally {
      if (activo.current) setEnviando(null);
    }
  }

  function reintentarCarga() {
    setCargando(true);
    setErrorCarga(false);
    setIntento((n) => n + 1);
  }

  return <>
    <span className="sr-only" role="status">{aviso}</span>
    <section className="tarjeta plantilla" aria-label="Tu plantilla de 1-to-1">
      <div className="plantilla__cabecera">
        <h2>Tu plantilla de 1-to-1</h2>
        <p>Los temas genéricos con los que empieza cada 1-to-1 con tus mentees. Es solo tuya: otros managers tienen la suya. Los cambios se aplican a partir del siguiente 1-to-1; los ya registrados no cambian.</p>
      </div>
      {cargando && skeleton && <div aria-busy="true">
        <span className="sr-only">Cargando…</span>
        <ol className="plantilla__filas">
          {[0, 1, 2].map((n) => <li key={n} className="plantilla__skeleton" aria-hidden="true" />)}
        </ol>
      </div>}
      {errorCarga && <div className="aviso aviso--error" role="alert">
        <p>No hemos podido cargar la plantilla. Revisa tu conexión.</p>
        <button className="boton boton--secundario" type="button" onClick={reintentarCarga}>Reintentar</button>
      </div>}
      {!cargando && !errorCarga && <ol className="plantilla__filas" aria-label="Temas de la plantilla">
        {vigentes.map((t, i) => <li className="plantilla__fila" key={t.id}>
          <span className="plantilla__numero">{i + 1}</span>
          {editando === t.id ? (
            <form className="plantilla__edicion" onSubmit={(e) => void guardarEdicion(e, t)} noValidate>
              <label className="campo">
                <span className="sr-only">{t.tema}</span>
                <input value={borrador} autoFocus readOnly={enviando !== null}
                  onChange={(e) => { setBorrador(e.target.value); setErrorEdicion(null); }}
                  aria-invalid={errorEdicion !== null}
                  aria-describedby={errorEdicion !== null ? `${base}-error-edicion-${t.id}` : undefined} />
                {errorEdicion !== null && <span id={`${base}-error-edicion-${t.id}`} className="campo__error" role="alert">{errorEdicion}</span>}
              </label>
              <button className="accion" type="submit" aria-disabled={bloqueado}
                ref={(el) => { editarRefs.current[t.id] = el; }}>
                {enviando === t.id ? 'Guardando…' : 'Guardar'}
              </button>
              <button className="accion accion--tenue" type="button" aria-disabled={bloqueado}
                onClick={() => cancelarEdicion(t)}>Cancelar</button>
            </form>
          ) : <>
            <span className="plantilla__tema">{t.tema}</span>
            <div className="plantilla__acciones">
              <div className="plantilla__botones">
                <span className="plantilla__iconos">
                  <button className="boton-icono" type="button"
                    aria-label={moviendo?.id === t.id && moviendo.delta === -1 ? `Moviendo ${t.tema}` : `Subir ${t.tema}`}
                    aria-disabled={bloqueado || i === 0}
                    onClick={(e) => void mover(t, -1, i === 0, e.currentTarget)}>↑</button>
                  <button className="boton-icono" type="button"
                    aria-label={moviendo?.id === t.id && moviendo.delta === 1 ? `Moviendo ${t.tema}` : `Bajar ${t.tema}`}
                    aria-disabled={bloqueado || i === vigentes.length - 1}
                    onClick={(e) => void mover(t, 1, i === vigentes.length - 1, e.currentTarget)}>↓</button>
                </span>
                <button className="accion" type="button" aria-label={`Editar tema: ${t.tema}`}
                  aria-disabled={bloqueado}
                  ref={(el) => { editarRefs.current[t.id] = el; }}
                  onClick={() => abrirEdicion(t)}>Editar</button>
                <button className="accion accion--tenue" type="button"
                  aria-label={`${enviando === t.id ? 'Retirando' : 'Retirar'} tema: ${t.tema}`}
                  aria-describedby={vigentes.length === 1 ? `${base}-motivo-${t.id}` : undefined}
                  aria-disabled={bloqueado || vigentes.length === 1}
                  ref={(el) => { retirarRefs.current[t.id] = el; }}
                  onClick={() => void retirar(t)}>{enviando === t.id ? 'Retirando…' : 'Retirar'}</button>
              </div>
              {vigentes.length === 1 && <span id={`${base}-motivo-${t.id}`} className="plantilla__motivo">
                La plantilla necesita al menos un tema.
              </span>}
            </div>
          </>}
        </li>)}
      </ol>}
      {!cargando && !errorCarga && errorOperacion && <div className="aviso aviso--error" role="alert">
        No se ha podido guardar. Inténtalo de nuevo.
      </div>}
    </section>
    <section className="tarjeta plantilla__alta" aria-label="Añadir tema genérico">
      <div className="plantilla__alta__cabecera">
        <h2>Añadir tema genérico</h2>
        <p>Formúlalo como pregunta abierta, igual que los demás.</p>
      </div>
      <form className="plantilla__alta__form" onSubmit={añadir} noValidate aria-label="Añadir tema">
        <label className="campo">
          Tema
          <input ref={nombreRef} value={nombre} readOnly={enviando !== null}
            onChange={(e) => { setNombre(e.target.value); setErrorAlta(null); setErrorGuardadoAlta(false); }}
            placeholder="p. ej. ¿Cómo va tu formación?" required
            aria-invalid={errorAlta !== null}
            aria-describedby={errorAlta !== null ? `${base}-error-alta` : undefined} />
          {errorAlta !== null && <span id={`${base}-error-alta`} className="campo__error" role="alert">{errorAlta}</span>}
        </label>
        {errorGuardadoAlta && <div className="aviso aviso--error plantilla__alta__error" role="alert">
          No se ha podido guardar. Inténtalo de nuevo.
        </div>}
        <button className="boton boton--primario" disabled={bloqueado}>
          {enviando === 'alta' ? 'Añadiendo…' : 'Añadir tema'}
        </button>
      </form>
    </section>
    {!cargando && !errorCarga && retirados.length > 0 && <section className="plantilla__retirados" aria-label="Temas retirados">
      <h2>Retirados · {retirados.length}</h2>
      <ul>
        {retirados.map((t) => <li className="tarjeta tarjeta--plana plantilla__retirado" key={t.id}>
          <span>{t.tema}</span>
          <button className="accion" type="button"
            aria-label={`${enviando === t.id ? 'Reactivando' : 'Volver a usar'}: ${t.tema}`}
            aria-disabled={bloqueado}
            ref={(el) => { usarRefs.current[t.id] = el; }}
            onClick={() => void volverAUsar(t)}>{enviando === t.id ? 'Reactivando…' : 'Volver a usar'}</button>
        </li>)}
      </ul>
    </section>}
    {!cargando && !errorCarga && <p className="plantilla__pie">
      Cada cuenta nueva de manager empieza con los tres temas iniciales.{' '}
      <button ref={restablecerRef} className="plantilla__restablecer" type="button" aria-disabled={bloqueado}
        onClick={pedirRestablecer}>Restablecer plantilla inicial</button>
    </p>}
    {restablecerAbierto && <DialogoConfirmacion
      abierto titulo="¿Restablecer tu plantilla?" cancelar="Cancelar" confirmar="Restablecer plantilla"
      enviando={enviando === 'restablecer' ? 'Restableciendo…' : undefined}
      confirmarDeshabilitado={enviando === 'restablecer'}
      cancelarDeshabilitado={enviando === 'restablecer'}
      onCancelar={cancelarRestablecer} onConfirmar={() => void confirmarRestablecer()}>
      <p>Tus temas actuales pasarán a retirados.</p>
      {errorRestablecer && <div className="aviso aviso--error" role="alert">No se ha podido guardar. Inténtalo de nuevo.</div>}
    </DialogoConfirmacion>}
  </>;
}
