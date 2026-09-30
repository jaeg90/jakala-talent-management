import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';
import { correrPasada } from './application/pasada.js';
import type { Ticket } from './domain/model.js';
import type { Puertos } from './domain/ports.js';
import { crearAvisos } from './infrastructure/avisos.js';
import { cargarConfig, type ConfigPiloto } from './infrastructure/config.js';
import { crearEntrega } from './infrastructure/git.js';
import { crearFrontera } from './infrastructure/gh.js';
import { crearPuertas } from './infrastructure/npm.js';
import { crearSesiones } from './infrastructure/opencode.js';
import { crearPuertosSimulados } from './infrastructure/simulacion.js';

/**
 * El Piloto (ticket #11): un comando arranca el loop y su salida narra cada paso.
 *   npm run piloto             — pasada real (gh + sesiones + arnés + git)
 *   npm run piloto -- --simular — mismo loop con puertos simulados, sin efectos
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

/** La frontera de esta mañana (la del prototipo): para ensayar el loop sin tocar nada. */
function ticketsDeSimulacion(): Ticket[] {
  return [
    { numero: 3, titulo: 'Ticket 2: Mi equipo', cuerpo: '', estado: 'cerrado', bloqueadoPor: [] },
    { numero: 4, titulo: 'Ticket 3: Ficha de mentee y 1-to-1s', cuerpo: 'Spec del ticket 3.', estado: 'lista', bloqueadoPor: [] },
    { numero: 5, titulo: 'Ticket 4: Temas propios', cuerpo: 'Spec del ticket 4.', estado: 'lista', bloqueadoPor: [4] },
    { numero: 6, titulo: 'Ticket 5: Objetivos anuales', cuerpo: 'Spec del ticket 5.', estado: 'lista', bloqueadoPor: [4] },
    { numero: 7, titulo: 'Ticket 6: Incidencias', cuerpo: 'Spec del ticket 6.', estado: 'lista', bloqueadoPor: [4] },
    { numero: 8, titulo: 'Ticket 7: Catálogo de proyectos', cuerpo: 'Spec del ticket 7.', estado: 'lista', bloqueadoPor: [3] },
  ];
}

async function main(): Promise<void> {
  const simular = process.argv.includes('--simular');
  const config = await cargarConfig(RUTA_CONFIG);
  const puertos: Puertos = simular
    ? crearPuertosSimulados({ tickets: ticketsDeSimulacion(), hallazgos: [null], rojos: [null] }).puertos
    : puertosReales(config);

  if (simular) {
    console.log('— MODO SIMULACIÓN: ni gh, ni sesiones, ni arnés; un ensayo del loop —\n');
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
