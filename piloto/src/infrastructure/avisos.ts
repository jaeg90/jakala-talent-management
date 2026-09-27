import type { PuertoAvisos } from '../domain/ports.js';

/**
 * Adaptador de avisos: consola siempre; webhook opcional si la configuración
 * lo pide. El aviso nunca falla la pasada: el escalado ya está registrado en
 * el tracker; avisar es cortesía.
 */

export type ConfigAviso = { tipo: 'consola' } | { tipo: 'webhook'; url: string };

export function crearAvisos(aviso: ConfigAviso): PuertoAvisos {
  return {
    async avisar(mensaje: string): Promise<void> {
      console.log(`\n⚠ AVISO AL HUMANO — ${mensaje}\n`);
      if (aviso.tipo === 'webhook') {
        try {
          await fetch(aviso.url, {
            method: 'POST',
            headers: { 'content-type': 'application/json' },
            body: JSON.stringify({ texto: mensaje }),
          });
        } catch (error) {
          console.log(
            `(El webhook falló; el aviso queda solo en consola: ${
              error instanceof Error ? error.message : String(error)
            })`,
          );
        }
      }
    },
  };
}
