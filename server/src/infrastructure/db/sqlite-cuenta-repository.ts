import type { Database } from 'better-sqlite3';
import type { Manager } from '../../domain/model.js';
import type { CuentaRepository } from '../../domain/ports.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';

interface ManagerRow {
  id: string;
  email: string;
  name: string;
  debe_cambiar_contrasena: number;
}

/** Adaptador SQLite del puerto de cuentas: verificación y cambio de contraseña. */
export class SqliteCuentaRepository implements CuentaRepository {
  constructor(private readonly db: Database) {}

  async verificarContrasena(managerId: string, actual: string): Promise<boolean> {
    const row = this.db
      .prepare('SELECT password_hash FROM managers WHERE id = ?')
      .get(managerId) as { password_hash: string } | undefined;
    if (row === undefined) return false;
    return verifyPassword(actual, row.password_hash);
  }

  async cambiarContrasena(managerId: string, nueva: string): Promise<Manager> {
    const hash = hashPassword(nueva);
    this.db
      .prepare('UPDATE managers SET password_hash = ?, debe_cambiar_contrasena = 0 WHERE id = ?')
      .run(hash, managerId);
    const row = this.db
      .prepare('SELECT id, email, name, debe_cambiar_contrasena FROM managers WHERE id = ?')
      .get(managerId) as ManagerRow;
    return {
      id: row.id,
      email: row.email,
      name: row.name,
      debeCambiarContraseña: row.debe_cambiar_contrasena === 1,
    };
  }
}