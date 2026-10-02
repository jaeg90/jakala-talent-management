import { describe, expect, it } from 'vitest';
import { LoginService, TeamService } from '../../src/application/services.js';
import type { Authenticator, SessionStore, TeamRepository } from '../../src/domain/ports.js';
import type { Manager, MenteeConProyecto } from '../../src/domain/model.js';

const manager: Manager = { id: 'm-1', email: 'manager@jakala.example', name: 'Marta Manager', debeCambiarContraseña: false };

function fakeAuthenticator(found: boolean): Authenticator {
  return {
    async authenticate(_email: string, _password: string) {
      return found ? manager : null;
    },
  };
}

function fakeSessions(): SessionStore & { tokens: string[] } {
  const tokens: string[] = [];
  return {
    tokens,
    async create(m: Manager) {
      expect(m).toEqual(manager);
      const token = `token-${tokens.length + 1}`;
      tokens.push(token);
      return token;
    },
    async find(token: string) {
      return tokens.includes(token) ? manager : null;
    },
    async revoke() {},
    async invalidateOtherSessions() {},
    async updateManager() {},
  };
}

describe('LoginService', () => {
  it('devuelve token y manager con credenciales válidas', async () => {
    const sessions = fakeSessions();
    const service = new LoginService(fakeAuthenticator(true), sessions);

    const result = await service.login('manager@jakala.example', 'secreta123');

    expect(result).toEqual(['token-1', manager]);
  });

  it('devuelve null y no crea sesión con credenciales inválidas', async () => {
    const sessions = fakeSessions();
    const service = new LoginService(fakeAuthenticator(false), sessions);

    expect(await service.login('manager@jakala.example', 'mala')).toBeNull();
    expect(sessions.tokens).toEqual([]);
  });
});

describe('TeamService', () => {
  it('devuelve el equipo del manager con sus proyectos vigentes', async () => {
    const equipo: MenteeConProyecto[] = [
      { id: 'me-1', name: 'Ana Alonso', proyectos: ['Atlas Bank'] },
      { id: 'me-2', name: 'Beatriz Blanco', proyectos: [] },
    ];
    const repo: TeamRepository = {
      async teamOf(managerId) {
        expect(managerId).toBe('m-1');
        return equipo;
      },
    };
    const service = new TeamService(repo);

    expect(await service.teamOf(manager)).toEqual(equipo);
  });
});
