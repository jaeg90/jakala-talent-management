import type { PuertaConfig } from '../domain/model.js';
import type { PuertoPuertas } from '../domain/ports.js';
import { recortar, resultadoDeLinea } from './procesos.js';

/**
 * Adaptador de puertas: ejecuta el arnés determinista de la configuración,
 * en orden, en la raíz del repo. La primera puerta en rojo gana y su salida
 * viaja al núcleo como error. Ningún LLM juzga el resultado (ADR-0003).
 */

const MINUTOS_MAX_PUERTA = 20;

export function crearPuertas(puertas: PuertaConfig[], raiz: string): PuertoPuertas {
  return {
    async ejecutar(): Promise<{ puerta: string; salida: string } | null> {
      for (const puerta of puertas) {
        const resultado = await resultadoDeLinea(puerta.comando, {
          cwd: raiz,
          minutos: MINUTOS_MAX_PUERTA,
        });
        if (resultado.codigo !== 0) {
          return { puerta: puerta.nombre, salida: recortar(resultado.salida) };
        }
      }
      return null;
    },
  };
}
