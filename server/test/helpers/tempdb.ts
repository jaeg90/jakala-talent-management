import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';

const dirs: string[] = [];

/** Ruta de BD temporal en un directorio único; se limpia con cleanupTempDirs. */
export function tempDbPath(): string {
  const dir = mkdtempSync(join(tmpdir(), 'jtm-'));
  dirs.push(dir);
  return join(dir, 'jtm.db');
}

/** Borra los directorios temporales creados por tempDbPath. Llamar en afterAll. */
export function cleanupTempDirs(): void {
  while (dirs.length > 0) {
    const dir = dirs.pop();
    if (dir !== undefined) rmSync(dir, { recursive: true, force: true });
  }
}
