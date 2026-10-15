import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

interface Permiso {
  action: string;
  resource: string;
  effect: string;
}

function leerPermisos(): Permiso[] {
  const ruta = new URL('../../opencode.json', import.meta.url);
  return JSON.parse(readFileSync(ruta, 'utf-8')).permissions as Permiso[];
}

describe('opencode.json respeta el ADR-0006', () => {
  it('ninguna regla es ask', () => {
    const permisos = leerPermisos();
    const ask = permisos.filter((p) => p.effect === 'ask');
    expect(
      ask,
      'ADR-0006: los límites se expresan como deny, nunca como ask. Reglas en ask: ' +
        JSON.stringify(ask),
    ).toEqual([]);
  });

  it('las operaciones irreversibles de git están denegadas', () => {
    const permisos = leerPermisos();
    const irreversibles = [
      'git push',
      'git push *',
      'git commit',
      'git commit *',
      'git merge *',
      'gh pr merge *',
    ];
    for (const recurso of irreversibles) {
      expect(
        permisos.some((p) => p.action === 'shell' && p.resource === recurso && p.effect === 'deny'),
        `ADR-0006: la operación irreversible «${recurso}» debe estar denegada (deny) en opencode.json.`,
      ).toBe(true);
    }
  });

  it('external_directory está denegado', () => {
    const permisos = leerPermisos();
    expect(
      permisos.some(
        (p) => p.action === 'external_directory' && p.resource === '*' && p.effect === 'deny',
      ),
      'ADR-0006: el acceso a directorios externos al repo debe estar denegado (deny) en opencode.json.',
    ).toBe(true);
  });
});
