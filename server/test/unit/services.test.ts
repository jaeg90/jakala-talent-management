import { describe, expect, it } from 'vitest';
import { LoginService, TeamService } from '../../src/application/services.js';
import type { Authenticator, SessionStore, TeamRepository } from '../../src/domain/ports.js';
import type { Manager, Mentee } from '../../src/domain/model.js';

const manager: Manager = { id: 'm-1', email: 'manager@jakala.example', name: 'Marta Manager' };

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
  it('devuelve los mentees del manager', async () => {
    const mentees: Mentee[] = [];
    const repo: TeamRepository = { async menteesOf(managerId) {
      expect(managerId).toBe('m-1');
      return mentees;
    } };
    const service = new TeamService(repo);

    expect(await service.menteesOf(manager)).toEqual([]);
  });
});
