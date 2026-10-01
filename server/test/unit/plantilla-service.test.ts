import { describe, expect, it } from 'vitest';
import { PlantillaService } from '../../src/application/plantilla_service.js';
import type { PlantillaRepository } from '../../src/domain/ports.js';
import type { Manager, TemaPlantilla } from '../../src/domain/model.js';

const manager: Manager = { id: 'm-1', email: 'manager@jakala.example', name: 'Marta Manager' };

function tema(id: string, orden: number, estado: 'vigente' | 'retirado' = 'vigente'): TemaPlantilla {
  return { id, managerId: 'm-1', tema: `Tema ${id}`, orden, estado };
}

describe('PlantillaService', () => {
  function fakeRepository(): PlantillaRepository {
    const plantilla = [tema('a', 0), tema('b', 1), tema('c', 2)];
    return {
      async plantillaOf(managerId) {
        expect(managerId).toBe('m-1');
        return plantilla;
      },
      async addTema(managerId, texto) {
        expect(managerId).toBe('m-1');
        return { id: 'nuevo', managerId, tema: texto, orden: 3, estado: 'vigente' };
      },
      async editarTema(managerId, temaId, texto) {
        expect(managerId).toBe('m-1');
        return { id: temaId, managerId, tema: texto, orden: 0, estado: 'vigente' };
      },
      async moverTema(managerId, temaId, delta) {
        expect(managerId).toBe('m-1');
        return [temaId === 'c' && delta === -1 ? tema('c', 1) : tema('a', 0)];
      },
      async retirarTema(managerId, temaId) {
        expect(managerId).toBe('m-1');
        return { ...tema(temaId, 0), estado: 'retirado' };
      },
      async reactivarTema(managerId, temaId) {
        expect(managerId).toBe('m-1');
        return { ...tema(temaId, 3), estado: 'vigente' };
      },
      async restablecerPlantilla(managerId) {
        expect(managerId).toBe('m-1');
        return plantilla;
      },
    };
  }

  it('lista la plantilla del manager', async () => {
    const service = new PlantillaService(fakeRepository());
    await expect(service.plantillaOf(manager)).resolves.toHaveLength(3);
  });

  it('añade un tema con texto recortado y validado', async () => {
    const service = new PlantillaService(fakeRepository());
    await expect(service.addTema(manager, '  Formación  ')).resolves.toMatchObject({ tema: 'Formación' });
  });

  it('rechaza un texto vacío sin llegar al repositorio', async () => {
    let llamado = false;
    const repo: PlantillaRepository = {
      async plantillaOf() {
        return [];
      },
      async addTema() {
        llamado = true;
        return tema('x', 0);
      },
      async editarTema() {
        return tema('x', 0);
      },
      async moverTema() {
        return [];
      },
      async retirarTema() {
        return tema('x', 0);
      },
      async reactivarTema() {
        return tema('x', 0);
      },
      async restablecerPlantilla() {
        return [];
      },
    };
    const service = new PlantillaService(repo);

    await expect(service.addTema(manager, '   ')).rejects.toThrow();
    expect(llamado).toBe(false);
  });

  it('edita el texto de un tema', async () => {
    const service = new PlantillaService(fakeRepository());
    await expect(service.editarTema(manager, 'a', ' Nuevo texto ')).resolves.toMatchObject({
      id: 'a',
      tema: 'Nuevo texto',
    });
  });

  it('sube y baja un tema', async () => {
    const service = new PlantillaService(fakeRepository());
    await expect(service.subir(manager, 'c')).resolves.toHaveLength(1);
    await expect(service.bajar(manager, 'a')).resolves.toHaveLength(1);
  });

  it('retira un tema solo si queda otro vigente (regla de dominio)', async () => {
    const service = new PlantillaService(fakeRepository());
    await expect(service.retirarTema(manager, 'a')).resolves.toMatchObject({ estado: 'retirado' });
  });

  it('retirar el último vigente lanza antes de tocar el repositorio', async () => {
    let llamado = false;
    const repo: PlantillaRepository = {
      async plantillaOf() {
        return [tema('unico', 0)];
      },
      async addTema() {
        return tema('x', 0);
      },
      async editarTema() {
        return tema('x', 0);
      },
      async moverTema() {
        return [];
      },
      async retirarTema() {
        llamado = true;
        return tema('unico', 0, 'retirado');
      },
      async reactivarTema() {
        return tema('x', 0);
      },
      async restablecerPlantilla() {
        return [];
      },
    };
    const service = new PlantillaService(repo);

    await expect(service.retirarTema(manager, 'unico')).rejects.toThrow(/último/);
    expect(llamado).toBe(false);
  });

  it('reactiva un tema retirado y restablece la plantilla', async () => {
    const service = new PlantillaService(fakeRepository());
    await expect(service.reactivarTema(manager, 'a')).resolves.toMatchObject({ estado: 'vigente' });
    await expect(service.restablecerPlantilla(manager)).resolves.toHaveLength(3);
  });
});