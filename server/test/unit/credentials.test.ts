import { afterAll, describe, expect, it } from 'vitest';
import type { Database } from 'better-sqlite3';
import { hashPassword, verifyPassword } from '../../src/infrastructure/auth/passwords.js';
import { SeedAuthenticator } from '../../src/infrastructure/auth/seed-authenticator.js';
import { openDatabase } from '../../src/infrastructure/db/sqlite.js';
import { seed } from '../../src/infrastructure/db/seed.js';
import { cleanupTempDirs, tempDbPath } from '../helpers/tempdb.js';

const dbs: Database[] = [];

afterAll(() => {
  for (const db of dbs) db.close();
  cleanupTempDirs();
});

/** BD temporal sembrada; se cierra en afterAll antes de borrar el directorio. */
function seededDb(): Database {
  const db = openDatabase(tempDbPath());
  seed(db);
  dbs.push(db);
  return db;
}

describe('hash de contraseñas', () => {
  it('verifica la contraseña correcta', () => {
    const hash = hashPassword('secreta123');
    expect(verifyPassword('secreta123', hash)).toBe(true);
  });

  it('rechaza la contraseña incorrecta', () => {
    const hash = hashPassword('secreta123');
    expect(verifyPassword('otra-cosa', hash)).toBe(false);
  });

  it('produce hashes con sal distinta por llamada', () => {
    expect(hashPassword('secreta123')).not.toEqual(hashPassword('secreta123'));
  });
});

describe('SeedAuthenticator (puerto de autenticación)', () => {
  it('acepta credenciales del manager semilla', async () => {
    const authenticator = new SeedAuthenticator(seededDb());

    const manager = await authenticator.authenticate('manager@jakala.example', 'secreta123');

    expect(manager).not.toBeNull();
    expect(manager?.email).toBe('manager@jakala.example');
    expect(manager?.name).toBe('Marta Manager');
  });

  it('devuelve el flag de contraseña temporal según la semilla', async () => {
    const authenticator = new SeedAuthenticator(seededDb());

    const julia = await authenticator.authenticate('julia@jakala.example', 'secreta123');
    const marta = await authenticator.authenticate('manager@jakala.example', 'secreta123');
    const diego = await authenticator.authenticate('diego@jakala.example', 'secreta123');
    const lucia = await authenticator.authenticate('lucia@jakala.example', 'secreta123');

    expect(julia?.debeCambiarContraseña).toBe(true);
    expect(marta?.debeCambiarContraseña).toBe(false);
    expect(diego?.debeCambiarContraseña).toBe(false);
    expect(lucia?.debeCambiarContraseña).toBe(false);
  });

  it('rechaza la contraseña incorrecta', async () => {
    const authenticator = new SeedAuthenticator(seededDb());

    expect(await authenticator.authenticate('manager@jakala.example', 'mala')).toBeNull();
  });

  it('rechaza un email desconocido', async () => {
    const authenticator = new SeedAuthenticator(seededDb());

    expect(await authenticator.authenticate('nadie@jakala.example', 'secreta123')).toBeNull();
  });
});
