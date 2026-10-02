import { useRef, useState } from 'react';
import { useNavigate } from 'react-router';
import { useAuth } from './auth';

const MENSAJE_ERROR = 'Email o contraseña incorrectos. Revísalos e inténtalo de nuevo.';

/** Login rediseñado (spec §01): logo, campos, error, botón y pie con redirección post-login. */
export function Login() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [enviando, setEnviando] = useState(false);
  const passwordRef = useRef<HTMLInputElement>(null);

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    setEnviando(true);
    try {
      const manager = await login(email, password);
      // Contraseña temporal → Perfil y contraseña (el flag lo transporta #43; el aviso es #24).
      navigate(manager.debeCambiarContraseña ? '/ajustes/perfil' : '/equipo');
    } catch {
      setError(MENSAJE_ERROR);
      setEnviando(false);
      passwordRef.current?.focus();
    }
  }

  return (
    <main className="login">
      <form className="tarjeta tarjeta--login" onSubmit={handleSubmit}>
        <div className="login__marca">
          <span className="logo" aria-hidden="true">J</span>
          <div className="login__titulos">
            <h1>JTM</h1>
            <p className="login__subtitulo">Jakala Talent Management</p>
          </div>
        </div>

        <label className="campo">
          Email
          <input
            type="email"
            value={email}
            onChange={(e) => setEmail(e.target.value)}
            autoComplete="username"
            aria-invalid={error !== null}
            aria-describedby={error !== null ? 'login-error' : undefined}
            required
          />
        </label>

        <label className="campo">
          Contraseña
          <input
            ref={passwordRef}
            type="password"
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            autoComplete="current-password"
            aria-invalid={error !== null}
            aria-describedby={error !== null ? 'login-error' : undefined}
            required
          />
        </label>

        {error !== null && (
          <div id="login-error" className="aviso aviso--error" role="alert">{error}</div>
        )}

        <button className="boton boton--primario login__boton" type="submit" disabled={enviando}>
          {enviando ? 'Iniciando sesión…' : 'Iniciar sesión'}
        </button>

        <p className="login__pie">Solo para managers de Jakala.</p>
      </form>
    </main>
  );
}