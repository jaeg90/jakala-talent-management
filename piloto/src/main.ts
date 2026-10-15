import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { correrPasada } from './application/pasada.js';
import type { Puertos } from './domain/ports.js';
import { crearAvisos } from './infrastructure/avisos.js';
import { cargarConfig, type ConfigPiloto } from './infrastructure/config.js';
import { ESCENARIOS, elegirModo } from './infrastructure/escenarios.js';
import { crearEntrega } from './infrastructure/git.js';
import { crearFrontera } from './infrastructure/gh.js';
import { crearPuertas } from './infrastructure/npm.js';
import { crearSesiones } from './infrastructure/opencode.js';
import { crearPuertosSimulados } from './infrastructure/simulacion.js';

/**
 * El Piloto (ticket #11): un comando arranca el loop y su salida narra cada paso.
 *   npm run piloto                       — pasada real (gh + sesiones + arnés + git)
 *   npm run piloto -- --simular[=<escenario>] — mismo loop con puertos simulados.
 * Escenarios: feliz, reparacion, puerta-roja, escalado,
 * devolucion-revisora, devolucion-implementadora.
 */

/** dist/main.js → la raíz del repo está dos niveles arriba. */
const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..', '..');
const RUTA_CONFIG = resolve(RAIZ, 'piloto', 'piloto.config.json');

function puertosReales(config: ConfigPiloto): Puertos {
  return {
    frontera: crearFrontera(config.etiquetas),
    sesiones: crearSesiones(config.modelos, config.sesiones, config.puertas),
    puertas: crearPuertas(config.puertas, RAIZ),
    avisos: crearAvisos(config.aviso),
    entrega: crearEntrega(config.modoEntrega, RAIZ),
  };
}

async function main(): Promise<void> {
  const modo = elegirModo(process.argv.slice(2));
  if (modo.tipo === 'error') {
    console.error(modo.mensaje);
    process.exitCode = 1;
    return;
  }
  const config = await cargarConfig(RUTA_CONFIG);
  const puertos: Puertos =
    modo.tipo === 'simulado'
      ? crearPuertosSimulados(ESCENARIOS[modo.nombre].guion).puertos
      : puertosReales(config);

  if (modo.tipo === 'simulado') {
    console.log(`— MODO SIMULACIÓN · escenario «${modo.nombre}»: ni gh, ni sesiones, ni arnés; un ensayo del loop —`);
    console.log(ESCENARIOS[modo.nombre].descripcion);
    console.log('');
  }
  await correrPasada(
    puertos,
    { reintentos: config.reintentos, etiquetas: config.etiquetas },
    (linea) => console.log(linea),
  );
}

main().catch((error: unknown) => {
  console.error(
    `\n✗ El Piloto se detuvo con un error imprevisto: ${
      error instanceof Error ? error.message : String(error)
    }`,
  );
  process.exitCode = 1;
});
