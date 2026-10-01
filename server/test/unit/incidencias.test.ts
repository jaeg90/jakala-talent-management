import { describe, expect, it } from 'vitest';
import {
  crearIncidenciaAbierta,
  resolverIncidencia,
  validarDescripcionIncidencia,
  validarNotaResolucion,
} from '../../src/domain/incidencias.js';
import { IncidenciaService } from '../../src/application/incidencia_service.js';
import type { Incidencia, Manager } from '../../src/domain/model.js';
import type { IncidenciaConMentee, IncidenciaRepository } from '../../src/domain/ports.js';

const manager: Manager = { id: 'm-1', email: 'manager@jakala.example', name: 'Marta Manager', debeCambiarContraseña: false };

function abierta(): Incidencia {
  return {
    id: 'i-1',
    menteeId: 'me-1',
    descripcion: 'Baja médica',
    estado: 'abierta',
    notaResolucion: '',
    fechaAlta: '2026-09-27',
    fechaResolucion: null,
  };
}

describe('validación de la incidencia', () => {
  it('recorta la descripción y la nota de resolución', () => {
    expect(validarDescripcionIncidencia('  Baja médica  ')).toBe('Baja médica');
    expect(validarNotaResolucion('  Reincorporada  ')).toBe('Reincorporada');
  });

  it('rechaza una descripción en blanco', () => {
    expect(() => validarDescripcionIncidencia('   ')).toThrow();
  });

  it('rechaza una nota de resolución en blanco', () => {
    expect(() => validarNotaResolucion('   ')).toThrow();
  });
});

describe('crearIncidenciaAbierta', () => {
  it('nace abierta, sin nota ni fecha de resolución', () => {
    expect(crearIncidenciaAbierta('Baja médica', '2026-09-27')).toEqual({
      descripcion: 'Baja médica',
      estado: 'abierta',
      notaResolucion: '',
      fechaAlta: '2026-09-27',
      fechaResolucion: null,
    });
  });
});

describe('ciclo de la incidencia: abierta → resuelta (sin reapertura)', () => {
  it('resuelve una incidencia abierta con nota y fecha de resolución', () => {
    const resuelta = resolverIncidencia(abierta(), 'Reincorporada el lunes', '2026-10-05');

    expect(resuelta).toEqual({
      ...abierta(),
      estado: 'resuelta',
      notaResolucion: 'Reincorporada el lunes',
      fechaResolucion: '2026-10-05',
    });
  });

  it('no vuelve a resolver una incidencia ya resuelta', () => {
    const resuelta = resolverIncidencia(abierta(), 'Tras hablar con RRHH', '2026-10-05');

    expect(() => resolverIncidencia(resuelta, 'Otra nota', '2026-10-06')).toThrow(
      /no puede resolverse de nuevo/,
    );
  });
});

describe('IncidenciaService', () => {
  const incidencia: Incidencia = abierta();
  const abiertaConMentee: IncidenciaConMentee = { ...abierta(), menteeName: 'Ana Alonso' };

  function fakeRepository(): IncidenciaRepository {
    return {
      async abiertasDe(managerId) {
        expect(managerId).toBe('m-1');
        return [abiertaConMentee];
      },
      async historialDe(managerId, menteeId) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return [incidencia];
      },
      async addIncidencia(managerId, menteeId, descripcion) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return { ...incidencia, descripcion };
      },
      async resolverIncidencia(managerId, incidenciaId, nota) {
        expect(managerId).toBe('m-1');
        expect(incidenciaId).toBe('i-1');
        return { ...incidencia, estado: 'resuelta', notaResolucion: nota, fechaResolucion: '2026-10-05' };
      },
    };
  }

  it('lista las incidencias abiertas del equipo', async () => {
    const service = new IncidenciaService(fakeRepository());

    await expect(service.abiertasDe(manager)).resolves.toEqual([abiertaConMentee]);
  });

  it('lista el historial de la mentee', async () => {
    const service = new IncidenciaService(fakeRepository());

    await expect(service.historialDe(manager, 'me-1')).resolves.toEqual([incidencia]);
  });

  it('da de alta con la descripción recortada', async () => {
    const service = new IncidenciaService(fakeRepository());

    await expect(service.addIncidencia(manager, 'me-1', '  Baja médica  ')).resolves.toMatchObject({
      descripcion: 'Baja médica',
    });
  });

  it('resuelve con la nota recortada', async () => {
    const service = new IncidenciaService(fakeRepository());

    await expect(service.resolverIncidencia(manager, 'i-1', '  Reincorporada  ')).resolves.toMatchObject({
      estado: 'resuelta',
      notaResolucion: 'Reincorporada',
    });
  });

  it('rechaza una descripción vacía sin llegar al repositorio', async () => {
    let llamado = false;
    const repo: IncidenciaRepository = {
      async abiertasDe() {
        return [];
      },
      async historialDe() {
        return [];
      },
      async addIncidencia() {
        llamado = true;
        return incidencia;
      },
      async resolverIncidencia() {
        return incidencia;
      },
    };
    const service = new IncidenciaService(repo);

    await expect(service.addIncidencia(manager, 'me-1', '   ')).rejects.toThrow();
    expect(llamado).toBe(false);
  });

  it('rechaza una nota de resolución vacía sin llegar al repositorio', async () => {
    let llamado = false;
    const repo: IncidenciaRepository = {
      async abiertasDe() {
        return [];
      },
      async historialDe() {
        return [];
      },
      async addIncidencia() {
        return incidencia;
      },
      async resolverIncidencia() {
        llamado = true;
        return incidencia;
      },
    };
    const service = new IncidenciaService(repo);

    await expect(service.resolverIncidencia(manager, 'i-1', '   ')).rejects.toThrow();
    expect(llamado).toBe(false);
  });
});