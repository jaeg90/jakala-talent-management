import { describe, expect, it } from 'vitest';
import { validarNombreTemaPropio, validarSinDuplicadosTemaPropio } from '../../src/domain/temas-propios.js';
import { TemaPropioService } from '../../src/application/tema_propio_service.js';
import type { PlantillaRepository, TemaPropioRepository } from '../../src/domain/ports.js';
import type { Manager, TemaPropio, TemaPlantilla } from '../../src/domain/model.js';

const manager: Manager = { id: 'm-1', email: 'manager@jakala.example', name: 'Marta Manager', debeCambiarContraseña: false };

describe('validarNombreTemaPropio', () => {
  it('devuelve el nombre recortado cuando no está vacío', () => {
    expect(validarNombreTemaPropio('  formación en curso  ')).toBe('formación en curso');
  });

  it('lanza si el nombre queda vacío al recortar', () => {
    expect(() => validarNombreTemaPropio('   ')).toThrow();
  });
});

describe('validarSinDuplicadosTemaPropio', () => {
  const propio = (tema: string, estado: 'vigente' | 'retirado' = 'vigente'): TemaPropio => ({
    id: tema,
    menteeId: 'me-1',
    tema,
    desde: '2026-10-01',
    estado,
    retiradoEl: estado === 'retirado' ? '2026-10-02' : null,
  });

  it('no lanza con un nombre sin colisiones', () => {
    expect(() =>
      validarSinDuplicadosTemaPropio('carga', [propio('formación')], [{ tema: '¿Cómo estás?' }], 'Ana'),
    ).not.toThrow();
  });

  it('lanza contra otro tema propio vigente (sin mayúsculas ni tildes)', () => {
    expect(() =>
      validarSinDuplicadosTemaPropio('FORMACIÓN', [propio('formación')], [], 'Ana'),
    ).toThrow('Ana ya tiene un tema propio con ese nombre.');
  });

  it('lanza contra un tema propio retirado', () => {
    expect(() =>
      validarSinDuplicadosTemaPropio('formación', [propio('formación', 'retirado')], [], 'Ana'),
    ).toThrow('Ya lo tienes en retirados. Pulsa «Volver a usar».');
  });

  it('lanza contra un tema genérico vigente de la plantilla', () => {
    expect(() =>
      validarSinDuplicadosTemaPropio('¿Cómo estás?', [], [{ tema: '¿Cómo estás?' }], 'Ana'),
    ).toThrow('Tu plantilla ya tiene un tema con ese nombre.');
  });
});

describe('TemaPropioService', () => {
  const temaPropio: TemaPropio = {
    id: 'tp-1',
    menteeId: 'me-1',
    tema: 'formación en curso',
    desde: '2026-10-01',
    estado: 'vigente',
    retiradoEl: null,
  };

  function fakeRepository(): TemaPropioRepository {
    return {
      async nombreDeMentee(managerId, menteeId) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return 'Ana Alonso';
      },
      async temasPropiosOf(managerId, menteeId) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return [temaPropio];
      },
      async addTemaPropio(managerId, menteeId, tema) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return { ...temaPropio, tema };
      },
      async retirarTemaPropio(managerId, menteeId, temaPropioId) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return temaPropioId === 'tp-1';
      },
    };
  }

  function fakePlantilla(temas: TemaPlantilla[] = []): PlantillaRepository {
    return {
      async plantillaOf() {
        return temas;
      },
      async addTema() {
        throw new Error('no usado');
      },
      async editarTema() {
        throw new Error('no usado');
      },
      async moverTema() {
        throw new Error('no usado');
      },
      async retirarTema() {
        throw new Error('no usado');
      },
      async reactivarTema() {
        throw new Error('no usado');
      },
      async restablecerPlantilla() {
        throw new Error('no usado');
      },
    };
  }

  it('lista los temas propios de la mentee del manager', async () => {
    const service = new TemaPropioService(fakeRepository(), fakePlantilla());

    await expect(service.temasPropiosOf(manager, 'me-1')).resolves.toEqual([temaPropio]);
  });

  it('da de alta un tema recortado y validado', async () => {
    const service = new TemaPropioService(fakeRepository(), fakePlantilla());

    await expect(service.addTemaPropio(manager, 'me-1', '  formación  ')).resolves.toEqual({
      ...temaPropio,
      tema: 'formación',
    });
  });

  it('rechaza un tema vacío sin llegar al repositorio', async () => {
    let llamado = false;
    const repo: TemaPropioRepository = {
      async nombreDeMentee() {
        return 'Ana Alonso';
      },
      async temasPropiosOf() {
        return [];
      },
      async addTemaPropio() {
        llamado = true;
        return temaPropio;
      },
      async retirarTemaPropio() {
        return false;
      },
    };
    const service = new TemaPropioService(repo, fakePlantilla());

    await expect(service.addTemaPropio(manager, 'me-1', '   ')).rejects.toThrow();
    expect(llamado).toBe(false);
  });

  it('retira un tema y devuelve si lo encontró', async () => {
    const service = new TemaPropioService(fakeRepository(), fakePlantilla());

    await expect(service.retirarTemaPropio(manager, 'me-1', 'tp-1')).resolves.toBe(true);
    await expect(service.retirarTemaPropio(manager, 'me-1', 'tp-otro')).resolves.toBe(false);
  });
});