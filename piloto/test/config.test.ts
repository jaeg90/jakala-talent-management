import { mkdtemp, readFile, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { fileURLToPath } from 'node:url';
import { afterEach, describe, expect, it } from 'vitest';
import { cargarConfig } from '../src/infrastructure/config.js';

const RUTA_CONFIG_REAL = fileURLToPath(new URL('../piloto.config.json', import.meta.url));

let directorio: string | undefined;

async function escribirConfig(parcial: Record<string, unknown>): Promise<string> {
  const real = JSON.parse(await readFile(RUTA_CONFIG_REAL, 'utf8')) as Record<string, unknown>;
  directorio = await mkdtemp(join(tmpdir(), 'piloto-config-'));
  const ruta = join(directorio, 'piloto.config.json');
  await writeFile(ruta, JSON.stringify({ ...real, ...parcial }), 'utf8');
  return ruta;
}

afterEach(async () => {
  if (directorio) {
    await rm(directorio, { recursive: true, force: true });
    directorio = undefined;
  }
});

describe('cargarConfig', () => {
  it('sin PILOTO_OPENCODE usa el comando de la configuración', async () => {
    const ruta = await escribirConfig({ sesiones: { comando: 'mi-opencode', tiempoMaxMinutos: 45 } });
    const config = await cargarConfig(ruta, {});
    expect(config.sesiones.comando).toBe('mi-opencode');
  });

  it('PILOTO_OPENCODE tiene prioridad sobre la configuración', async () => {
    const ruta = await escribirConfig({ sesiones: { comando: 'mi-opencode', tiempoMaxMinutos: 45 } });
    const config = await cargarConfig(ruta, { PILOTO_OPENCODE: 'C:/x/opencode.exe' });
    expect(config.sesiones.comando).toBe('C:/x/opencode.exe');
  });

  it('PILOTO_OPENCODE vacío se ignora', async () => {
    const ruta = await escribirConfig({ sesiones: { comando: 'mi-opencode', tiempoMaxMinutos: 45 } });
    const config = await cargarConfig(ruta, { PILOTO_OPENCODE: '   ' });
    expect(config.sesiones.comando).toBe('mi-opencode');
  });

  it('sin comando en configuración ni entorno usa opencode', async () => {
    const ruta = await escribirConfig({ sesiones: undefined });
    const config = await cargarConfig(ruta, {});
    expect(config.sesiones.comando).toBe('opencode');
  });

  it('la configuración del repo no contiene rutas personales', async () => {
    const config = await cargarConfig(RUTA_CONFIG_REAL, {});
    const texto = await readFile(RUTA_CONFIG_REAL, 'utf8');
    expect(config.sesiones.comando).toBe('opencode');
    expect(texto).not.toContain('Users');
    expect(texto).not.toContain('AppData');
  });
});