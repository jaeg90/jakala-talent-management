import { describe, expect, it } from 'vitest';
import { validarNombreTemaPropio } from '../../src/domain/temas-propios.js';
import { TemaPropioService } from '../../src/application/tema_propio_service.js';
import type { TemaPropioRepository } from '../../src/domain/ports.js';
import type { Manager, TemaPropio } from '../../src/domain/model.js';

const manager: Manager = { id: 'm-1', email: 'manager@jakala.example', name: 'Marta Manager' };

describe('validarNombreTemaPropio', () => {
  it('devuelve el nombre recortado cuando no está vacío', () => {
    expect(validarNombreTemaPropio('  formación en curso  ')).toBe('formación en curso');
  });

  it('lanza si el nombre queda vacío al recortar', () => {
    expect(() => validarNombreTemaPropio('   ')).toThrow();
  });
});

describe('TemaPropioService', () => {
  const temaPropio: TemaPropio = { id: 'tp-1', menteeId: 'me-1', tema: 'formación en curso' };

  function fakeRepository(): TemaPropioRepository {
    return {
      async temasPropiosOf(managerId, menteeId) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return [temaPropio];
      },
      async addTemaPropio(managerId, menteeId, tema) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return { id: 'tp-1', menteeId, tema };
      },
      async removeTemaPropio(managerId, temaPropioId) {
        expect(managerId).toBe('m-1');
        return temaPropioId === 'tp-1';
      },
    };
  }

  it('lista los temas propios de la mentee del manager', async () => {
    const service = new TemaPropioService(fakeRepository());

    await expect(service.temasPropiosOf(manager, 'me-1')).resolves.toEqual([temaPropio]);
  });

  it('da de alta un tema recortado y validado', async () => {
    const service = new TemaPropioService(fakeRepository());

    await expect(service.addTemaPropio(manager, 'me-1', '  formación  ')).resolves.toEqual({
      id: 'tp-1',
      menteeId: 'me-1',
      tema: 'formación',
    });
  });

  it('rechaza un tema vacío sin llegar al repositorio', async () => {
    let llamado = false;
    const repo: TemaPropioRepository = {
      async temasPropiosOf() {
        return [];
      },
      async addTemaPropio() {
        llamado = true;
        return temaPropio;
      },
      async removeTemaPropio() {
        return false;
      },
    };
    const service = new TemaPropioService(repo);

    await expect(service.addTemaPropio(manager, 'me-1', '   ')).rejects.toThrow();
    expect(llamado).toBe(false);
  });

  it('da de baja un tema y devuelve si lo encontró', async () => {
    const service = new TemaPropioService(fakeRepository());

    await expect(service.removeTemaPropio(manager, 'tp-1')).resolves.toBe(true);
    await expect(service.removeTemaPropio(manager, 'tp-otro')).resolves.toBe(false);
  });
});