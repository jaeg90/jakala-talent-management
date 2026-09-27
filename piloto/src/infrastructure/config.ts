import { readFile } from 'node:fs/promises';
import type { Etiquetas, PuertaConfig } from '../domain/model.js';
import type { ConfigAviso } from './avisos.js';
import type { ConfigSesiones, Modelos } from './opencode.js';

/**
 * Configuración del Piloto (ADR-0004): todo lo que varía por proyecto vive
 * aquí — modelos por papel, N, puertas, etiquetas del tracker, modo de
 * entrega y canal de aviso. Cambiarlo no es tocar código.
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

export async function cargarConfig(ruta: string): Promise<ConfigPiloto> {
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
      comando: crudo.sesiones?.comando ?? 'opencode',
      tiempoMaxMinutos: crudo.sesiones?.tiempoMaxMinutos ?? 30,
    },
    puertas: exigir(crudo.puertas, 'puertas'),
    etiquetas: exigir(crudo.etiquetas, 'etiquetas'),
    aviso: crudo.aviso ?? { tipo: 'consola' },
  };
}
