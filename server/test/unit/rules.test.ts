import { describe, expect, it } from 'vitest';
import { validarUnManagerPorMentee } from '../../src/domain/rules.js';
import type { Mentee } from '../../src/domain/model.js';

function mentee(id: string, managerId: string): Mentee {
  return { id, managerId, name: `Mentee ${id}` };
}

describe('Regla: un manager por mentee a la vez', () => {
  it('acepta una lista donde cada mentee tiene un único manager', () => {
    const mentees = [mentee('me-1', 'm-1'), mentee('me-2', 'm-2'), mentee('me-3', 'm-1')];

    expect(() => validarUnManagerPorMentee(mentees)).not.toThrow();
  });

  it('acepta una lista vacía', () => {
    expect(() => validarUnManagerPorMentee([])).not.toThrow();
  });

  it('lanza si una mentee aparece con dos managers distintos', () => {
    const mentees = [mentee('me-1', 'm-1'), mentee('me-1', 'm-2')];

    expect(() => validarUnManagerPorMentee(mentees)).toThrow(/me-1/);
  });

  it('acepta la misma mentee repetida con el mismo manager (sin conflicto)', () => {
    const mentees = [mentee('me-1', 'm-1'), mentee('me-1', 'm-1')];

    expect(() => validarUnManagerPorMentee(mentees)).not.toThrow();
  });
});
