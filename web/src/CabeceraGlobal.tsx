import { Link } from 'react-router';
import { useAuth } from './auth';
import { iniciales, tonoAvatar } from './lib/avatar';

/**
 * Cabecera global (spec §Esqueletos): logo JTM · «Ajustes» · avatar + nombre del
 * manager · «Cerrar sesión». La comparten Mi equipo (#17) y el área Ajustes; la
 * ficha (#18 y siguientes) no la usa (tiene su propio sidebar).
 */
export function CabeceraGlobal({ enAjustes = false }: { enAjustes?: boolean }) {
  const { manager, logout } = useAuth();

  return (
    <header className="cabecera-global">
      <div className="cabecera-global__marca">
        <Link to="/equipo" aria-label="JTM — Mi equipo">
          <span className="logo logo--cabecera" aria-hidden="true">J</span>
          <span className="cabecera-global__wordmark">JTM</span>
        </Link>
      </div>
      <div className="cabecera-global__opciones">
        <Link to="/ajustes/perfil" aria-current={enAjustes ? 'page' : undefined}>Ajustes</Link>
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
  );
}