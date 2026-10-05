import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from 'react';
import { api } from './api';

type CuentaCreada = Awaited<ReturnType<typeof api.crearManager>>;

/** Estado de Ajustes que sobrevive a sus rutas, pero nunca a un cambio de sesión. */
function useEstadoManagers() {
  const [creada, setCreada] = useState<CuentaCreada | null>(null);
  const [enviando, setEnviando] = useState(false);
  const crearRef = useRef<HTMLButtonElement>(null);
  const activo = useRef(true);
  const focoPendiente = useRef(false);

  useEffect(() => {
    activo.current = true;
    return () => { activo.current = false; };
  }, []);

  const devolverFoco = useCallback(() => {
    const boton = crearRef.current;
    if (!focoPendiente.current || !boton || boton.disabled) return;
    boton.focus();
    if (document.activeElement === boton) focoPendiente.current = false;
  }, []);

  async function crearManager(nombre: string, email: string) {
    setEnviando(true);
    try {
      const respuesta = await api.crearManager(nombre, email);
      if (activo.current) setCreada(respuesta);
      return respuesta;
    } finally {
      if (activo.current) setEnviando(false);
    }
  }

  function cerrar() {
    focoPendiente.current = true;
    setCreada(null);
  }

  return { creada, enviando, crearManager, cerrar, crearRef, devolverFoco };
}

const Contexto = createContext<ReturnType<typeof useEstadoManagers> | null>(null);

export function AjustesManagersEstado({ children }: { children: ReactNode }) {
  const estado = useEstadoManagers();
  return <Contexto.Provider value={estado}>{children}</Contexto.Provider>;
}

export function useAjustesManagers() {
  const estado = useContext(Contexto);
  if (estado === null) throw new Error('Falta el contenedor de Ajustes.');
  return estado;
}
