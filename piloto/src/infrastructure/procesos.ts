import { spawn } from 'node:child_process';

/**
 * Ejecución de procesos para los adaptadores: gh, git, opencode y las puertas.
 * Los errores de los procesos son del adaptador; el núcleo nunca los ve.
 */

export interface OpcionesProceso {
  cwd?: string;
  /** Minutos máximos; vencido, el proceso se mata y se rechaza. */
  minutos?: number;
  /** Texto que se escribe en la entrada estándar del proceso. */
  entrada?: string;
}

/** Ejecuta un binario con argumentos (sin shell); resuelve con stdout o rechaza con stderr. */
export function ejecutar(comando: string, args: string[], opciones: OpcionesProceso = {}): Promise<string> {
  return new Promise((resolve, reject) => {
    let stdout = '';
    let stderr = '';
    let terminado = false;
    const hijo = spawn(comando, args, { cwd: opciones.cwd, stdio: ['pipe', 'pipe', 'pipe'] });

    const termina = (error: Error | null, salida?: string): void => {
      if (terminado) return;
      terminado = true;
      if (temporizador !== undefined) clearTimeout(temporizador);
      if (error === null) resolve(salida ?? '');
      else reject(error);
    };

    const temporizador =
      opciones.minutos === undefined
        ? undefined
        : setTimeout(() => {
            hijo.kill();
            termina(new Error(`«${comando}» agotó sus ${opciones.minutos} minutos y fue terminado.`));
          }, opciones.minutos * 60_000);

    hijo.stdout?.on('data', (datos: Buffer) => {
      stdout += datos.toString();
    });
    hijo.stderr?.on('data', (datos: Buffer) => {
      stderr += datos.toString();
    });
    hijo.on('error', (error: Error) => {
      termina(new Error(`No se pudo ejecutar «${comando}»: ${error.message}`));
    });
    if (opciones.entrada !== undefined) hijo.stdin?.end(opciones.entrada);
    else hijo.stdin?.end();
    hijo.on('close', (codigo) => {
      if (codigo === 0) termina(null, stdout);
      else
        termina(
          new Error(`«${comando} ${args.join(' ')}» terminó con código ${codigo}.\n${recortar(stderr || stdout)}`),
        );
    });
  });
}

/** El desenlace de una línea ejecutada con shell: código de salida y salida completa. */
export interface ResultadoLinea {
  /** Código de salida; null si el proceso fue terminado por tiempo. */
  codigo: number | null;
  salida: string;
}

/** Ejecuta una línea con shell (comandos de la configuración, p. ej. las puertas). */
export function resultadoDeLinea(linea: string, opciones: OpcionesProceso = {}): Promise<ResultadoLinea> {
  return new Promise((resolve, reject) => {
    let salida = '';
    let terminado = false;
    const hijo = spawn(linea, { shell: true, cwd: opciones.cwd, stdio: ['ignore', 'pipe', 'pipe'] });

    const termina = (resultado: ResultadoLinea): void => {
      if (terminado) return;
      terminado = true;
      if (temporizador !== undefined) clearTimeout(temporizador);
      resolve(resultado);
    };

    const temporizador =
      opciones.minutos === undefined
        ? undefined
        : setTimeout(() => {
            hijo.kill();
            termina({ codigo: null, salida: `${salida}\n(agotó sus ${opciones.minutos} minutos y fue terminado)` });
          }, opciones.minutos * 60_000);

    hijo.stdout?.on('data', (datos: Buffer) => {
      salida += datos.toString();
    });
    hijo.stderr?.on('data', (datos: Buffer) => {
      salida += datos.toString();
    });
    hijo.on('error', (error: Error) => {
      if (temporizador !== undefined) clearTimeout(temporizador);
      reject(new Error(`No se pudo ejecutar «${linea}»: ${error.message}`));
    });
    hijo.on('close', (codigo) => {
      termina({ codigo, salida });
    });
  });
}

/** Recorta una salida larga por el final (lo que importa es el error). */
export function recortar(texto: string, maximo = 2000): string {
  const limpio = texto.trim();
  return limpio.length <= maximo ? limpio : `…${limpio.slice(-maximo)}`;
}
