import { describe, expect, it } from 'vitest';
import {
  crearCambioProyecto,
  proyectoActualDeCambios,
  validarFechaCambio,
  validarMotivoCambio,
  validarNombreProyecto,
} from '../../src/domain/proyectos.js';
import { ProyectoService } from '../../src/application/proyecto_service.js';
import type { CambioProyecto, Manager, ProyectoCatalogo } from '../../src/domain/model.js';
import type { ProyectoRepository, SituacionProyecto } from '../../src/domain/ports.js';

const manager: Manager = { id: 'm-1', email: 'manager@jakala.example', name: 'Marta Manager', debeCambiarContraseña: false };

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

  it('la unicidad es exacta, sin normalizar mayúsculas ni tildes', () => {
    expect(validarNombreProyecto('  Átlas  ', [{ name: 'Atlas' }])).toBe('Átlas');
    expect(validarNombreProyecto('atlas', [{ name: 'Atlas' }])).toBe('atlas');
    expect(() => validarNombreProyecto(' Atlas ', [{ name: 'Otro' }, { name: 'Atlas' }])).toThrow('Ya existe un proyecto con ese nombre.');
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
  const catalogo: ProyectoCatalogo = {
    id: 'pr-atlas',
    name: 'Atlas Bank',
    estado: 'vigente',
    fechaRetirada: null,
    numMentees: 1,
  };
  const situacion: SituacionProyecto = { project: catalogo, cambios: [cambio('pr-atlas')] };

  function fakeRepository(opts: { registrarCambio?: () => void } = {}): ProyectoRepository {
    return {
      async proyectos() {
        return [catalogo];
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
        opts.registrarCambio?.();
        return { id: 'c-2', menteeId, ...cambioRecibido, origenId: 'pr-atlas' };
      },
      async proyectosActualesDe(managerId, menteeId) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return [{ id: 'pr-atlas', name: 'Atlas Bank', desde: '2026-09-01' }];
      },
      async entrarEnProyecto(managerId, menteeId, entrada) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return {
          mentee: menteeId,
          proyecto: entrada.proyecto,
          desde: entrada.desde,
          motivoEntrada: entrada.motivoEntrada,
          hasta: null,
          motivoSalida: null,
        };
      },
      async salirDeProyecto(managerId, menteeId, proyectoId, salida) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        expect(proyectoId).toBe('pr-atlas');
        return {
          mentee: menteeId,
          proyecto: proyectoId,
          desde: '2026-09-01',
          motivoEntrada: 'Alta',
          hasta: salida.hasta,
          motivoSalida: salida.motivoSalida,
        };
      },
      async retirarProyecto(proyectoId) {
        return { id: proyectoId, estado: 'retirado', fechaRetirada: '2026-10-01' };
      },
      async reactivarProyecto(proyectoId) {
        return { id: proyectoId, estado: 'vigente', fechaRetirada: null };
      },
    };
  }

  it('lista el catálogo de proyectos', async () => {
    const service = new ProyectoService(fakeRepository());

    await expect(service.proyectos()).resolves.toEqual([catalogo]);
  });

  it('da de alta con el nombre recortado', async () => {
    const service = new ProyectoService(fakeRepository());

    await expect(service.addProyecto('  Nuevo cliente  ')).resolves.toMatchObject({ name: 'Nuevo cliente' });
  });

  it('rechaza el duplicado recortado antes de escribir, también si está retirado', async () => {
    for (const fechaRetirada of [null, '2026-06-01']) {
      const repo = fakeRepository();
      repo.proyectos = async () => [{ ...catalogo, fechaRetirada }];
      let escrito = false;
      repo.addProyecto = async (name) => { escrito = true; return { id: 'nuevo', name }; };
      await expect(new ProyectoService(repo).addProyecto('  Atlas Bank  ')).rejects.toThrow('Ya existe un proyecto con ese nombre.');
      expect(escrito).toBe(false);
    }
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
    const service = new ProyectoService(
      fakeRepository({
        registrarCambio() {
          llamado = true;
        },
      }),
    );

    await expect(
      service.registrarCambio(manager, 'me-1', { fecha: '2026-09-27', destinoId: 'pr-nova', motivo: '   ' }),
    ).rejects.toThrow();
    expect(llamado).toBe(false);
  });

  it('lee los proyectos actuales de una mentee delegando en el repositorio', async () => {
    const service = new ProyectoService(fakeRepository());

    await expect(service.proyectosActuales(manager, 'me-1')).resolves.toEqual([
      { id: 'pr-atlas', name: 'Atlas Bank', desde: '2026-09-01' },
    ]);
  });

  it('entra en un proyecto con fecha y motivo recortados', async () => {
    const service = new ProyectoService(fakeRepository());

    await expect(
      service.entrarEnProyecto(manager, 'me-1', {
        proyecto: 'pr-atlas',
        desde: ' 2026-09-01 ',
        motivoEntrada: ' Alta ',
      }),
    ).resolves.toMatchObject({
      proyecto: 'pr-atlas',
      desde: '2026-09-01',
      motivoEntrada: 'Alta',
      hasta: null,
      motivoSalida: null,
    });
  });

  it('rechaza una entrada con motivo vacío sin llegar al repositorio', async () => {
    let llamado = false;
    const repo = fakeRepository();
    const original = repo.entrarEnProyecto.bind(repo);
    repo.entrarEnProyecto = async (...args) => {
      llamado = true;
      return original(...args);
    };
    const service = new ProyectoService(repo);

    await expect(
      service.entrarEnProyecto(manager, 'me-1', {
        proyecto: 'pr-atlas',
        desde: '2026-09-01',
        motivoEntrada: '   ',
      }),
    ).rejects.toThrow();
    expect(llamado).toBe(false);
  });

  it('sale de un proyecto con fecha y motivo recortados', async () => {
    const service = new ProyectoService(fakeRepository());

    await expect(
      service.salirDeProyecto(manager, 'me-1', 'pr-atlas', {
        hasta: ' 2026-10-01 ',
        motivoSalida: ' Fin ',
      }),
    ).resolves.toMatchObject({ hasta: '2026-10-01', motivoSalida: 'Fin' });
  });

  it('retira y reactiva un proyecto delegando en el repositorio', async () => {
    const service = new ProyectoService(fakeRepository());

    await expect(service.retirarProyecto('pr-atlas')).resolves.toMatchObject({
      estado: 'retirado',
    });
    await expect(service.reactivarProyecto('pr-atlas')).resolves.toMatchObject({
      estado: 'vigente',
      fechaRetirada: null,
    });
  });
});
