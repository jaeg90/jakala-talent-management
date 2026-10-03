import type { Manager } from '../domain/model.js';
import type { Authenticator, SessionStore, TeamRepository } from '../domain/ports.js';
import {
  badgeAntiguedad,
  necesitaAtencion,
  ordenarEquipo,
  type FilaDeEquipo,
} from '../domain/equipo.js';

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

/** Caso de uso: el equipo de un manager, con las señales agregadas de cada mentee
 * y la señal de dominio «Necesita atención», ordenado atención-primero. */
export class TeamService {
  constructor(private readonly teamRepository: TeamRepository) {}

  async teamOf(manager: Manager, hoy: string = hoyISO()): Promise<FilaDeEquipo[]> {
    const equipo = await this.teamRepository.teamOf(manager.id);
    return ordenarEquipo(
      equipo.map((mentee): FilaDeEquipo => ({
        ...mentee,
        necesitaAtencion: necesitaAtencion(
          mentee.incidenciasAbiertas,
          mentee.ultimoUnoAUno,
          hoy,
        ),
        badgeAntiguedad: badgeAntiguedad(mentee.ultimoUnoAUno, hoy),
      })),
    );
  }
}

/** Hoy en ISO (YYYY-MM-DD), para que el cálculo de días sea determinista en tests. */
function hoyISO(): string {
  return new Date().toISOString().slice(0, 10);
}
