import type { Manager, Mentee } from '../domain/model.js';
import type { Authenticator, SessionStore, TeamRepository } from '../domain/ports.js';

/** Caso de uso: iniciar sesión con email y contraseña. */
export class LoginService {
  constructor(
    private readonly authenticator: Authenticator,
    private readonly sessions: SessionStore,
  ) {}

  /** Devuelve [token, manager] si las credenciales son válidas; null en caso contrario. */
  async login(email: string, password: string): Promise<[string, Manager] | null> {
    const manager = await this.authenticator.authenticate(email, password);
    if (manager === null) return null;
    const token = await this.sessions.create(manager);
    return [token, manager];
  }
}

/** Caso de uso: el equipo de un manager (vacío en el esqueleto). */
export class TeamService {
  constructor(private readonly teamRepository: TeamRepository) {}

  menteesOf(manager: Manager): Promise<Mentee[]> {
    return this.teamRepository.menteesOf(manager.id);
  }
}
