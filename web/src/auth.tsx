import { createContext, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import type { ManagerAutenticado } from './api';
import { api } from './api';

/**
 * Sesión de JTM: el router y cada pantalla leen de aquí en vez de mantener su
 * propio estado de autenticación (sustituye al interruptor Login/Team de App.tsx).
 */

type EstadoAuth =
  | { status: 'checking'; manager: null }
  | { status: 'anonymous'; manager: null }
  | { status: 'authenticated'; manager: ManagerAutenticado };

export interface ValorAuth {
  status: EstadoAuth['status'];
  manager: ManagerAutenticado | null;
  login: (email: string, password: string) => Promise<ManagerAutenticado>;
  logout: () => Promise<void>;
  actualizarManager: (manager: ManagerAutenticado) => void;
}

const AuthContext = createContext<ValorAuth | null>(null);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [estado, setEstado] = useState<EstadoAuth>({ status: 'checking', manager: null });
  // El resultado de la consulta inicial de sesión solo es válido mientras nadie
  // haya iniciado o cerrado sesión: si llega tarde (tras un login/logout), no debe
  // sobrescribir el estado con `anonymous` (carrera).
  const decidido = useRef(false);

  useEffect(() => {
    api
      .session()
      .then(({ manager }) => {
        if (decidido.current) return;
        setEstado({ status: 'authenticated', manager });
      })
      .catch(() => {
        if (decidido.current) return;
        setEstado({ status: 'anonymous', manager: null });
      });
  }, []);

  async function login(email: string, password: string): Promise<ManagerAutenticado> {
    const { manager } = await api.login(email, password);
    decidido.current = true;
    setEstado({ status: 'authenticated', manager });
    return manager;
  }

  async function logout(): Promise<void> {
    await api.logout();
    decidido.current = true;
    setEstado({ status: 'anonymous', manager: null });
  }

  function actualizarManager(manager: ManagerAutenticado): void {
    decidido.current = true;
    setEstado({ status: 'authenticated', manager });
  }

  return (
    <AuthContext.Provider
      value={{ status: estado.status, manager: estado.manager, login, logout, actualizarManager }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): ValorAuth {
  const valor = useContext(AuthContext);
  if (valor === null) throw new Error('useAuth debe usarse dentro de AuthProvider');
  return valor;
}