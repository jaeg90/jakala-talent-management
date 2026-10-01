import type { Manager } from '../../domain/model.js';
import type { Authenticator } from '../../domain/ports.js';
import type { Database } from 'better-sqlite3';
import { verifyPassword } from './passwords.js';

interface ManagerRow {
  id: string;
  email: string;
  name: string;
  password_hash: string;
  debe_cambiar_contrasena: number;
}

/**
 * Adaptador del puerto de autenticación (ADR-0002): comprueba email y
 * contraseña contra los managers precargados en la semilla de SQLite.
 */
export class SeedAuthenticator implements Authenticator {
  constructor(private readonly db: Database) {}

  async authenticate(email: string, password: string): Promise<Manager | null> {
    const row = this.db
      .prepare(
        'SELECT id, email, name, password_hash, debe_cambiar_contrasena FROM managers WHERE email = ?',
      )
      .get(email) as ManagerRow | undefined;
    if (row === undefined) return null;
    if (!verifyPassword(password, row.password_hash)) return null;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      debeCambiarContraseña: row.debe_cambiar_contrasena === 1,
    };
  }
}
