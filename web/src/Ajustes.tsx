import { useEffect, useState } from 'react';
import { Link, Outlet } from 'react-router';
import { api } from './api';
import { useAuth } from './auth';
import { iniciales, tonoAvatar } from './lib/avatar';

/**
 * Área Ajustes (spec §Esqueletos): cabecera global + «← Mi equipo» + h1 + nav de
 * ajustes con los grupos Mi cuenta · Personas · Catálogo. Los ítems aparecen
 * conforme llegan sus tickets; el único que existe hoy es «Perfil y contraseña».
 */
export function AjustesLayout() {
  const { manager, logout } = useAuth();

  return (
    <>
      <header className="cabecera-global">
        <div className="cabecera-global__marca">
          <span className="logo logo--cabecera" aria-hidden="true">J</span>
          <span className="cabecera-global__wordmark">JTM</span>
        </div>
        <div className="cabecera-global__opciones">
          <Link to="/ajustes/perfil" aria-current="page">Ajustes</Link>
          <span className="cabecera-global__manager">
            <span className={`avatar avatar--${tonoAvatar(manager?.id ?? '')}`}>
              {manager ? iniciales(manager.name) : ''}
            </span>
            {manager?.name}
          </span>
          <button className="cabecera-global__logout" type="button" onClick={() => void logout()}>
            Cerrar sesión
          </button>
        </div>
      </header>

      <main className="ajustes">
        <div className="ajustes__titulo">
          <Link className="ajustes__volver" to="/equipo">← Mi equipo</Link>
          <h1>Ajustes</h1>
        </div>
        <div className="ajustes__cuerpo">
          <nav className="nav-lateral nav-lateral--ajustes" aria-label="Secciones de ajustes">
            <div className="nav-lateral__grupo">
              <span className="nav-lateral__titulo">Mi cuenta</span>
              <Link to="/ajustes/perfil" aria-current="page">Perfil y contraseña</Link>
            </div>
            <div className="nav-lateral__grupo">
              <span className="nav-lateral__titulo">Personas</span>
              {/* Mentees (#26) y Managers (#25) llegan con sus tickets. */}
            </div>
            <div className="nav-lateral__grupo">
              <span className="nav-lateral__titulo">Catálogo</span>
              {/* Proyectos (#29) llega con su ticket. */}
            </div>
          </nav>
          <div className="ajustes__contenido">
            <Outlet />
          </div>
        </div>
      </main>
    </>
  );
}

/** Aviso que aparece con el flag de contraseña temporal activo (bloqueo duro). */
const AVISO_BLOQUEO = 'Cambia tu contraseña temporal para continuar.';

/** Perfil y contraseña (spec §Ajustes · 3a): ficha del manager y cambio de contraseña. */
export function Perfil() {
  const { manager, actualizarManager } = useAuth();

  const [numMentees, setNumMentees] = useState<number | null>(null);
  const [actual, setActual] = useState('');
  const [nueva, setNueva] = useState('');
  const [repetida, setRepetida] = useState('');
  const [errorActual, setErrorActual] = useState<string | null>(null);
  const [errorRepetida, setErrorRepetida] = useState<string | null>(null);
  const [exito, setExito] = useState(false);
  const [enviando, setEnviando] = useState(false);

  const bloqueado = manager?.debeCambiarContraseña ?? false;

  // Nº de mentees: mientras el flag está activo, /api/team devuelve 403 y la
  // tarjeta muestra «—»; el dato se rellena al desbloquear.
  useEffect(() => {
    let activo = true;
    api
      .team()
      .then(({ mentees }) => {
        if (activo) setNumMentees(mentees.length);
      })
      .catch(() => {
        if (activo) setNumMentees(null);
      });
    return () => {
      activo = false;
    };
  }, [bloqueado]);

  // Un carácter es un punto de código Unicode (mismo cálculo que la regla de dominio).
  const cumpleLongitud = [...nueva].length >= 10;
  const cumpleDistinta = nueva !== '' && nueva !== actual;
  const puedeEnviar = !enviando && actual !== '' && cumpleLongitud && cumpleDistinta;

  const menteesTexto =
    numMentees === null
      ? '—'
      : numMentees === 1
        ? '1 mentee en tu equipo'
        : `${numMentees} mentees en tu equipo`;

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setErrorActual(null);
    setErrorRepetida(null);
    setExito(false);
    if (nueva !== repetida) {
      setErrorRepetida('Las contraseñas no coinciden.');
      return;
    }
    setEnviando(true);
    try {
      const { manager: actualizado } = await api.cambiarContrasena(actual, nueva);
      actualizarManager(actualizado);
      setActual('');
      setNueva('');
      setRepetida('');
      setExito(true);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      if (msg === 'La contraseña actual no es correcta.') setErrorActual(msg);
    } finally {
      setEnviando(false);
    }
  }

  if (manager === null) return null;

  return (
    <>
      {bloqueado && (
        <div className="aviso aviso--atencion" role="status">{AVISO_BLOQUEO}</div>
      )}

      <div className="tarjeta tarjeta--perfil">
        <span className={`avatar avatar--perfil avatar--${tonoAvatar(manager.id)}`}>
          {iniciales(manager.name)}
        </span>
        <div className="perfil__datos">
          <span className="perfil__nombre">{manager.name}</span>
          <span className="perfil__meta">{manager.email} · {menteesTexto}</span>
        </div>
      </div>

      <form className="tarjeta tarjeta--contrasena" onSubmit={handleSubmit} noValidate>
        <div className="contrasena__cabecera">
          <h2>Cambiar contraseña</h2>
          <p>Al guardarla, se cerrará la sesión en los demás navegadores.</p>
        </div>

        <label className="campo">
          Contraseña actual
          <input
            type="password"
            value={actual}
            onChange={(e) => setActual(e.target.value)}
            autoComplete="current-password"
            aria-invalid={errorActual !== null}
            aria-describedby={errorActual !== null ? 'error-actual' : undefined}
          />
          {errorActual !== null && (
            <span id="error-actual" className="campo__error" role="alert">{errorActual}</span>
          )}
        </label>

        <div className="contrasena__fila">
          <label className="campo">
            Nueva contraseña
            <input
              type="password"
              value={nueva}
              onChange={(e) => setNueva(e.target.value)}
              autoComplete="new-password"
              aria-describedby="requisitos-contrasena"
            />
          </label>
          <label className="campo">
            Repite la nueva contraseña
            <input
              type="password"
              value={repetida}
              onChange={(e) => setRepetida(e.target.value)}
              autoComplete="new-password"
              aria-invalid={errorRepetida !== null}
              aria-describedby={errorRepetida !== null ? 'error-repetida' : undefined}
            />
            {errorRepetida !== null && (
              <span id="error-repetida" className="campo__error" role="alert">{errorRepetida}</span>
            )}
          </label>
        </div>

        <ul id="requisitos-contrasena" className="contrasena__requisitos" aria-live="polite">
          <li className={cumpleLongitud ? 'requisito--cumplido' : undefined}>
            {cumpleLongitud ? '✓' : '○'} Mínimo 10 caracteres
          </li>
          <li className={cumpleDistinta ? 'requisito--cumplido' : undefined}>
            {cumpleDistinta ? '✓' : '○'} Distinta de la actual
          </li>
        </ul>

        {exito && (
          <div className="aviso aviso--exito" role="status">Contraseña cambiada.</div>
        )}

        <button
          className="boton boton--primario contrasena__boton"
          type="submit"
          disabled={!puedeEnviar}
        >
          Cambiar contraseña
        </button>
      </form>
    </>
  );
}