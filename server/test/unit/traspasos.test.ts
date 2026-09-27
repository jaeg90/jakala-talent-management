import { describe, expect, it } from 'vitest';
import {
  crearTraspaso,
  validarFechaTraspaso,
  validarMotivoTraspaso,
} from '../../src/domain/traspasos.js';
import { TraspasoService } from '../../src/application/traspaso_service.js';
import type { Manager, Traspaso } from '../../src/domain/model.js';
import type { TraspasoRepository } from '../../src/domain/ports.js';

const manager: Manager = { id: 'm-1', email: 'manager@jakala.example', name: 'Marta Manager' };

describe('validación del traspaso', () => {
  it('recorta la fecha y el motivo', () => {
    expect(validarFechaTraspaso('  2026-09-27  ')).toBe('2026-09-27');
    expect(validarMotivoTraspaso('  Reorganización  ')).toBe('Reorganización');
  });

  it('rechaza fecha o motivo en blanco', () => {
    expect(() => validarFechaTraspaso('   ')).toThrow();
    expect(() => validarMotivoTraspaso('   ')).toThrow();
  });
});

describe('crearTraspaso y la regla "un manager por mentee a la vez"', () => {
  it('rechaza un traspaso al mismo manager (destino === origen)', () => {
    expect(() => crearTraspaso('m-1', 'm-1', '2026-09-27', 'Sin cambio')).toThrow(/distinto/);
  });

  it('crea un traspaso entre dos managers distintos, dejando a la mentee bajo un único manager', () => {
    expect(crearTraspaso('m-1', 'm-2', '2026-09-27', 'Reorganización')).toEqual({
      origenId: 'm-1',
      destinoId: 'm-2',
      fecha: '2026-09-27',
      motivo: 'Reorganización',
    });
  });
});

describe('TraspasoService', () => {
  const traspaso: Traspaso = {
    id: 't-1',
    menteeId: 'me-1',
    origenId: 'm-1',
    destinoId: 'm-2',
    fecha: '2026-09-27',
    motivo: 'Reorganización',
  };

  function fakeRepository(): TraspasoRepository {
    return {
      async managers() {
        return [manager, { id: 'm-2', email: 'diego@jakala.example', name: 'Diego Domínguez' }];
      },
      async historialDe(managerId, menteeId) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return [traspaso];
      },
      async traspasar(managerId, menteeId, recibido) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return { id: 't-1', menteeId, origenId: 'm-1', ...recibido };
      },
    };
  }

  it('lista el catálogo de managers', async () => {
    const service = new TraspasoService(fakeRepository());

    await expect(service.managers()).resolves.toHaveLength(2);
  });

  it('consulta el historial de traspasos delegando en el repositorio', async () => {
    const service = new TraspasoService(fakeRepository());

    await expect(service.historialDe(manager, 'me-1')).resolves.toEqual([traspaso]);
  });

  it('registra el traspaso con fecha y motivo recortados', async () => {
    const service = new TraspasoService(fakeRepository());

    const resultado = await service.traspasar(manager, 'me-1', {
      fecha: ' 2026-09-27 ',
      destinoId: 'm-2',
      motivo: ' Reorganización ',
    });

    expect(resultado).toMatchObject({ fecha: '2026-09-27', motivo: 'Reorganización', destinoId: 'm-2' });
  });

  it('rechaza un motivo vacío sin llegar al repositorio', async () => {
    let llamado = false;
    const repo: TraspasoRepository = {
      async managers() {
        return [];
      },
      async historialDe() {
        return [];
      },
      async traspasar() {
        llamado = true;
        return traspaso;
      },
    };
    const service = new TraspasoService(repo);

    await expect(
      service.traspasar(manager, 'me-1', { fecha: '2026-09-27', destinoId: 'm-2', motivo: '   ' }),
    ).rejects.toThrow();
    expect(llamado).toBe(false);
  });
});