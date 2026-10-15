import { readFile } from 'node:fs/promises';
import type { Etiquetas, PuertaConfig } from '../domain/model.js';
import type { ConfigAviso } from './avisos.js';
import type { ConfigSesiones, Modelos } from './opencode.js';

/**
 * Configuración del Piloto (ADR-0004): todo lo que varía por proyecto vive
 * aquí — modelos por papel, N, puertas, etiquetas del tracker, modo de
 * entrega y canal de aviso. Cambiarlo no es tocar código.
 *
 * `PILOTO_OPENCODE` sobrescribe el binario de OpenCode (`sesiones.comando`)
 * para poder testear con un entorno propio; en Windows es además necesario:
 * `spawn` sin shell no resuelve los shims `.cmd` de npm y necesita la ruta
 * completa al `.exe` real.
 */

export interface ConfigPiloto {
  reintentos: number;
  modoEntrega: 'main' | 'rama';
  modelos: Modelos;
  sesiones: ConfigSesiones;
  puertas: PuertaConfig[];
  etiquetas: Etiquetas;
  aviso: ConfigAviso;
}

export async function cargarConfig(
  ruta: string,
  entorno: NodeJS.ProcessEnv = process.env,
): Promise<ConfigPiloto> {
  const crudo = JSON.parse(await readFile(ruta, 'utf8')) as Partial<ConfigPiloto>;
  const exigir = <T>(valor: T | undefined, campo: string): T => {
    if (valor === undefined) throw new Error(`Falta «${campo}» en la configuración del Piloto (${ruta}).`);
    return valor;
  };
  return {
    reintentos: exigir(crudo.reintentos, 'reintentos'),
    modoEntrega: (() => {
      const modo = exigir(crudo.modoEntrega, 'modoEntrega');
      if (modo !== 'main' && modo !== 'rama') {
        throw new Error(`«modoEntrega» debe ser «main» o «rama»; recibido: «${modo}».`);
      }
      return modo;
    })(),
    modelos: exigir(crudo.modelos, 'modelos'),
    sesiones: {
      comando:
        (entorno.PILOTO_OPENCODE && entorno.PILOTO_OPENCODE.trim() !== '' && entorno.PILOTO_OPENCODE) ||
        crudo.sesiones?.comando ||
        'opencode',
      tiempoMaxMinutos: crudo.sesiones?.tiempoMaxMinutos ?? 30,
    },
    puertas: exigir(crudo.puertas, 'puertas'),
    etiquetas: {
      lista: exigir(crudo.etiquetas?.lista, 'etiquetas.lista'),
      escalado: exigir(crudo.etiquetas?.escalado, 'etiquetas.escalado'),
      devolución: exigir(crudo.etiquetas?.devolución, 'etiquetas.devolución'),
    },
    aviso: crudo.aviso ?? { tipo: 'consola' },
  };
}
