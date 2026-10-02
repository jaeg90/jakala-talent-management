import { randomBytes } from 'node:crypto';

import type { Manager } from '../../domain/model.js';
import type { SessionStore } from '../../domain/ports.js';

/** Adaptador de sesiones en memoria: suficiente para el MVP de un solo proceso. */
export class MemorySessionStore implements SessionStore {
  private readonly sessions = new Map<string, Manager>();

  async create(manager: Manager): Promise<string> {
    const token = randomBytes(32).toString('hex');
    this.sessions.set(token, manager);
    return token;
  }

  async find(token: string): Promise<Manager | null> {
    return this.sessions.get(token) ?? null;
  }

  async revoke(token: string): Promise<void> {
    this.sessions.delete(token);
  }

  async invalidateOtherSessions(managerId: string, keepToken: string): Promise<void> {
    for (const [token, manager] of this.sessions) {
      if (token !== keepToken && manager.id === managerId) this.sessions.delete(token);
    }
  }

  async updateManager(token: string, manager: Manager): Promise<void> {
    if (this.sessions.has(token)) this.sessions.set(token, manager);
  }
}
