import type { Database } from 'better-sqlite3';
import { randomUUID } from 'node:crypto';
import type { Manager } from '../../domain/model.js';
import type { CuentaRepository } from '../../domain/ports.js';
import { hashPassword, verifyPassword } from '../auth/passwords.js';
import { insertarPlantillaInicial } from './seed.js';

interface ManagerRow {
  id: string;
  email: string;
  name: string;
  debe_cambiar_contrasena: number;
}

/** Adaptador SQLite de cuentas: alta atómica, censo y cambio de contraseña. */
export class SqliteCuentaRepository implements CuentaRepository {
  constructor(private readonly db: Database) {}

  async managers() {
    return this.db.prepare(`SELECT m.id, m.email, m.name, COUNT(e.id) AS numMentees
      FROM managers m LEFT JOIN mentees e ON e.manager_id = m.id
      GROUP BY m.id ORDER BY m.name`).all() as { id: string; email: string; name: string; numMentees: number }[];
  }

  async crearManager(name: string, email: string, temporal: string) {
    const id = randomUUID();
    const hash = hashPassword(temporal);
    this.db.transaction(() => {
      // Comprobación y escritura bajo la misma transacción: tampoco una carrera
      // puede crear dos cuentas con el mismo correo (sin distinguir mayúsculas).
      if (this.db.prepare('SELECT 1 FROM managers WHERE lower(email) = ?').get(email)) {
        throw new Error('Ya existe una cuenta con este email.');
      }
      this.db.prepare(`INSERT INTO managers (id, email, name, password_hash, debe_cambiar_contrasena)
        VALUES (?, ?, ?, ?, 1)`).run(id, email, name, hash);
      insertarPlantillaInicial(this.db, id);
    })();
    return { id, email, name, numMentees: 0 };
  }

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
