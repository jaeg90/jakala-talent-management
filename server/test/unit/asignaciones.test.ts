import { describe, expect, it } from 'vitest';
import {
  asignacionesVigentes,
  crearEntradaEnProyecto,
  proyectosActualesDe,
  reactivarProyecto,
  retirarProyecto,
  salirDeProyecto,
  validarRetirarProyecto,
  validarSinAsignacionVigente,
} from '../../src/domain/asignaciones.js';
import type { Asignacion, ProyectoConEstado } from '../../src/domain/asignaciones.js';

function vigente(proyecto: string, desde = '2026-09-01', mentee = 'me-1'): Asignacion {
  return {
    mentee,
    proyecto,
    desde,
    motivoEntrada: 'Incorporación',
    hasta: null,
    motivoSalida: null,
  };
}

function cerrada(proyecto: string, desde = '2026-09-01', hasta = '2026-09-30'): Asignacion {
  return { ...vigente(proyecto, desde), hasta, motivoSalida: 'Fin de proyecto' };
}

describe('asignacionesVigentes', () => {
  it('devuelve solo las asignaciones sin hasta', () => {
    const asignaciones = [vigente('pr-atlas'), cerrada('pr-nova'), vigente('pr-io')];

    expect(asignacionesVigentes(asignaciones).map((a) => a.proyecto)).toEqual([
      'pr-atlas',
      'pr-io',
    ]);
  });

  it('sin asignaciones devuelve una lista vacía', () => {
    expect(asignacionesVigentes([])).toEqual([]);
  });

  it('con todas vigentes las devuelve todas', () => {
    const asignaciones = [vigente('pr-atlas'), vigente('pr-nova')];

    expect(asignacionesVigentes(asignaciones)).toEqual(asignaciones);
  });
});

describe('proyectosActualesDe', () => {
  it('son los proyectos de las asignaciones sin hasta de esa mentee', () => {
    const asignaciones = [
      vigente('pr-atlas'),
      cerrada('pr-nova'),
      vigente('pr-io'),
    ];

    expect(proyectosActualesDe(asignaciones, 'me-1')).toEqual(['pr-atlas', 'pr-io']);
  });

  it('queda vacío cuando la mentee no tiene asignaciones vigentes (Sin proyecto)', () => {
    expect(proyectosActualesDe([cerrada('pr-atlas')], 'me-1')).toEqual([]);
    expect(proyectosActualesDe([], 'me-1')).toEqual([]);
  });

  it('no cuenta los proyectos vigentes de otras mentees', () => {
    const asignaciones = [vigente('pr-atlas', '2026-09-01', 'me-1'), vigente('pr-atlas', '2026-09-01', 'me-2')];

    expect(proyectosActualesDe(asignaciones, 'me-1')).toEqual(['pr-atlas']);
    expect(proyectosActualesDe(asignaciones, 'me-2')).toEqual(['pr-atlas']);
    expect(proyectosActualesDe(asignaciones, 'me-3')).toEqual([]);
  });
});

describe('validarSinAsignacionVigente / crearEntradaEnProyecto', () => {
  it('lanza al entrar dos veces al mismo proyecto sin salir antes (misma mentee)', () => {
    const asignaciones = [vigente('pr-atlas')];

    expect(() => validarSinAsignacionVigente(asignaciones, 'me-1', 'pr-atlas')).toThrow(/ya está/);
    expect(() =>
      crearEntradaEnProyecto('me-1', 'pr-atlas', '2026-10-01', 'Reincorporación', asignaciones),
    ).toThrow(/ya está/);
  });

  it('permite entrar de nuevo si ya salió antes (asignación cerrada)', () => {
    const asignaciones = [cerrada('pr-atlas')];

    expect(() => validarSinAsignacionVigente(asignaciones, 'me-1', 'pr-atlas')).not.toThrow();
  });

  it('permite entrar si no hay asignación a ese proyecto ni a otro', () => {
    expect(() => validarSinAsignacionVigente([], 'me-1', 'pr-atlas')).not.toThrow();
    expect(() => validarSinAsignacionVigente([vigente('pr-nova')], 'me-1', 'pr-atlas')).not.toThrow();
  });

  it('no bloquea la entrada por una asignación vigente de otra mentee al mismo proyecto', () => {
    const asignaciones = [vigente('pr-atlas', '2026-09-01', 'me-2')];

    expect(() => validarSinAsignacionVigente(asignaciones, 'me-1', 'pr-atlas')).not.toThrow();
    expect(() =>
      crearEntradaEnProyecto('me-1', 'pr-atlas', '2026-10-01', 'Incorporación', asignaciones),
    ).not.toThrow();
  });

  it('crea una entrada vigente (sin hasta ni motivo de salida)', () => {
    const entrada = crearEntradaEnProyecto(
      'me-1',
      'pr-atlas',
      '2026-10-01',
      'Incorporación',
      [],
    );

    expect(entrada).toEqual({
      mentee: 'me-1',
      proyecto: 'pr-atlas',
      desde: '2026-10-01',
      motivoEntrada: 'Incorporación',
      hasta: null,
      motivoSalida: null,
    });
  });
});

describe('salirDeProyecto', () => {
  it('registra la salida con fecha y motivo', () => {
    const salida = salirDeProyecto(vigente('pr-atlas', '2026-09-01'), '2026-10-05', 'Fin');

    expect(salida).toMatchObject({ proyecto: 'pr-atlas', hasta: '2026-10-05', motivoSalida: 'Fin' });
  });

  it('lanza si la fecha de salida es anterior a la de entrada', () => {
    expect(() => salirDeProyecto(vigente('pr-atlas', '2026-09-01'), '2026-08-15', 'Fin')).toThrow(
      /anterior a la fecha de entrada/,
    );
  });

  it('permite salir el mismo día de la entrada (hasta === desde)', () => {
    expect(() => salirDeProyecto(vigente('pr-atlas', '2026-09-01'), '2026-09-01', 'Fin')).not.toThrow();
  });

  it('se puede salir del último proyecto: la mentee queda «Sin proyecto»', () => {
    const entrada = crearEntradaEnProyecto('me-1', 'pr-atlas', '2026-09-01', 'Alta', []);
    const salida = salirDeProyecto(entrada, '2026-10-01', 'Fin');

    expect(asignacionesVigentes([salida])).toEqual([]);
    expect(proyectosActualesDe([salida], 'me-1')).toEqual([]);
  });
});

describe('validarRetirarProyecto', () => {
  it('lanza al retirar un proyecto con asignaciones vigentes', () => {
    expect(() => validarRetirarProyecto([vigente('pr-atlas')], 'pr-atlas')).toThrow(
      /asignaciones vigentes/,
    );
  });

  it('lanza aunque la asignación vigente sea de otra mentee', () => {
    expect(() => validarRetirarProyecto([vigente('pr-atlas', '2026-09-01', 'me-2')], 'pr-atlas')).toThrow(
      /asignaciones vigentes/,
    );
  });

  it('permite retirar un proyecto sin asignaciones vigentes', () => {
    expect(() => validarRetirarProyecto([], 'pr-atlas')).not.toThrow();
    expect(() => validarRetirarProyecto([cerrada('pr-atlas')], 'pr-atlas')).not.toThrow();
    expect(() => validarRetirarProyecto([vigente('pr-nova')], 'pr-atlas')).not.toThrow();
  });
});

describe('retirarProyecto / reactivarProyecto', () => {
  function proyecto(estado: 'vigente' | 'retirado'): ProyectoConEstado {
    return { id: 'pr-atlas', estado };
  }

  it('retira un proyecto vigente', () => {
    expect(retirarProyecto(proyecto('vigente'))).toEqual({ id: 'pr-atlas', estado: 'retirado' });
  });

  it('lanza al retirar un proyecto ya retirado', () => {
    expect(() => retirarProyecto(proyecto('retirado'))).toThrow(/vigente/);
  });

  it('reactiva un proyecto retirado', () => {
    expect(reactivarProyecto(proyecto('retirado'))).toEqual({ id: 'pr-atlas', estado: 'vigente' });
  });

  it('lanza al reactivar un proyecto ya vigente', () => {
    expect(() => reactivarProyecto(proyecto('vigente'))).toThrow(/retirado/);
  });
});