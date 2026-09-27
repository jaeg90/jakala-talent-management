import { describe, expect, it } from 'vitest';
import {
  crearCambioProyecto,
  proyectoActualDeCambios,
  validarFechaCambio,
  validarMotivoCambio,
  validarNombreProyecto,
} from '../../src/domain/proyectos.js';
import { ProyectoService } from '../../src/application/proyecto_service.js';
import type { CambioProyecto, Manager, Project } from '../../src/domain/model.js';
import type { ProyectoRepository, SituacionProyecto } from '../../src/domain/ports.js';

const manager: Manager = { id: 'm-1', email: 'manager@jakala.example', name: 'Marta Manager' };

function cambio(destinoId: string | null): CambioProyecto {
  return {
    id: 'c-1',
    menteeId: 'me-1',
    fecha: '2026-09-27',
    origenId: null,
    destinoId,
    motivo: 'Nueva asignación',
  };
}

describe('validación del catálogo y de los cambios de proyecto', () => {
  it('recorta el nombre del proyecto, la fecha y el motivo', () => {
    expect(validarNombreProyecto('  Atlas Bank  ')).toBe('Atlas Bank');
    expect(validarFechaCambio('  2026-09-27  ')).toBe('2026-09-27');
    expect(validarMotivoCambio('  Reorganización  ')).toBe('Reorganización');
  });

  it('rechaza nombre, fecha o motivo en blanco', () => {
    expect(() => validarNombreProyecto('   ')).toThrow();
    expect(() => validarFechaCambio('   ')).toThrow();
    expect(() => validarMotivoCambio('   ')).toThrow();
  });
});

describe('crearCambioProyecto', () => {
  it('rechaza un cambio que no cambia de proyecto (origen === destino)', () => {
    expect(() => crearCambioProyecto('pr-atlas', 'pr-atlas', '2026-09-27', 'Sin cambio')).toThrow(
      /distinto/,
    );
    expect(() => crearCambioProyecto(null, null, '2026-09-27', 'Sin cambio')).toThrow(/distinto/);
  });

  it('crea un cambio hacia otro proyecto o hacia ninguno', () => {
    expect(crearCambioProyecto('pr-atlas', 'pr-nova', '2026-09-27', 'Rotación')).toEqual({
      origenId: 'pr-atlas',
      destinoId: 'pr-nova',
      fecha: '2026-09-27',
      motivo: 'Rotación',
    });
    expect(crearCambioProyecto(null, 'pr-atlas', '2026-09-27', 'Primera asignación')).toMatchObject({
      origenId: null,
      destinoId: 'pr-atlas',
    });
    expect(crearCambioProyecto('pr-atlas', null, '2026-09-27', 'Fin de proyecto')).toMatchObject({
      origenId: 'pr-atlas',
      destinoId: null,
    });
  });
});

describe('proyecto actual único a partir del último cambio', () => {
  it('sin cambios no hay proyecto derivable', () => {
    expect(proyectoActualDeCambios([])).toBeNull();
  });

  it('con un único cambio, el proyecto actual es su destino', () => {
    expect(proyectoActualDeCambios([cambio('pr-nova')])).toBe('pr-nova');
  });

  it('con varios cambios, manda el destino del último', () => {
    const pasos = [cambio('pr-atlas'), { ...cambio('pr-nova'), id: 'c-2' }];
    expect(proyectoActualDeCambios(pasos)).toBe('pr-nova');
  });

  it('el último cambio puede dejar a la mentee sin proyecto', () => {
    const pasos = [cambio('pr-atlas'), { ...cambio(null), id: 'c-2' }];
    expect(proyectoActualDeCambios(pasos)).toBeNull();
  });
});

describe('ProyectoService', () => {
  const proyecto: Project = { id: 'pr-atlas', name: 'Atlas Bank' };
  const situacion: SituacionProyecto = { project: proyecto, cambios: [cambio('pr-atlas')] };

  function fakeRepository(): ProyectoRepository {
    return {
      async proyectos() {
        return [proyecto];
      },
      async addProyecto(name) {
        return { id: 'pr-nueva', name };
      },
      async situacionDe(managerId, menteeId) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return situacion;
      },
      async registrarCambio(managerId, menteeId, cambioRecibido) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return { id: 'c-2', menteeId, ...cambioRecibido, origenId: 'pr-atlas' };
      },
      async miembrosPorProyecto(managerId) {
        expect(managerId).toBe('m-1');
        return [{ projectId: 'pr-atlas', projectName: 'Atlas Bank', mentees: [{ id: 'me-1', name: 'Ana' }] }];
      },
    };
  }

  it('lista el catálogo de proyectos', async () => {
    const service = new ProyectoService(fakeRepository());

    await expect(service.proyectos()).resolves.toEqual([proyecto]);
  });

  it('da de alta con el nombre recortado', async () => {
    const service = new ProyectoService(fakeRepository());

    await expect(service.addProyecto('  Atlas Bank  ')).resolves.toMatchObject({ name: 'Atlas Bank' });
  });

  it('consultar la situación de la mentee delega en el repositorio', async () => {
    const service = new ProyectoService(fakeRepository());

    await expect(service.situacionDe(manager, 'me-1')).resolves.toEqual(situacion);
  });

  it('registra el cambio con fecha y motivo recortados', async () => {
    const service = new ProyectoService(fakeRepository());

    await expect(
      service.registrarCambio(manager, 'me-1', { fecha: ' 2026-09-27 ', destinoId: null, motivo: ' Fin ' }),
    ).resolves.toMatchObject({ fecha: '2026-09-27', motivo: 'Fin', destinoId: null });
  });

  it('rechaza un motivo vacío sin llegar al repositorio', async () => {
    let llamado = false;
    const repo: ProyectoRepository = {
      async proyectos() {
        return [];
      },
      async addProyecto() {
        return proyecto;
      },
      async situacionDe() {
        return { project: null, cambios: [] };
      },
      async registrarCambio() {
        llamado = true;
        return cambio('pr-nova');
      },
      async miembrosPorProyecto() {
        return [];
      },
    };
    const service = new ProyectoService(repo);

    await expect(
      service.registrarCambio(manager, 'me-1', { fecha: '2026-09-27', destinoId: 'pr-nova', motivo: '   ' }),
    ).rejects.toThrow();
    expect(llamado).toBe(false);
  });

  it('lista los mentees agrupados por proyecto', async () => {
    const service = new ProyectoService(fakeRepository());

    await expect(service.miembrosPorProyecto(manager)).resolves.toEqual([
      { projectId: 'pr-atlas', projectName: 'Atlas Bank', mentees: [{ id: 'me-1', name: 'Ana' }] },
    ]);
  });
});