import { describe, expect, it } from 'vitest';
import {
  crearObjetivoEnCurso,
  editarObjetivo,
  transicionarEstado,
  validarFechaLimite,
  validarTituloObjetivo,
} from '../../src/domain/objetivos.js';
import { ObjetivoService } from '../../src/application/objetivo_service.js';
import type { EstadoObjetivo, Manager, Objetivo } from '../../src/domain/model.js';
import type { ObjetivoRepository } from '../../src/domain/ports.js';

const manager: Manager = { id: 'm-1', email: 'manager@jakala.example', name: 'Marta Manager', debeCambiarContraseña: false };

function enCurso(): Objetivo {
  return {
    id: 'o-1',
    menteeId: 'me-1',
    titulo: 'Certificar en AWS',
    descripcion: 'Aprobar el examen de Solutions Architect',
    fechaLimite: '2026-12-31',
    estado: 'en curso',
  };
}

describe('validación del objetivo', () => {
  it('recorta el título y la fecha límite', () => {
    expect(validarTituloObjetivo('  Certificar en AWS  ')).toBe('Certificar en AWS');
    expect(validarFechaLimite('  2026-12-31  ', '2026-01-01')).toBe('2026-12-31');
  });

  it('rechaza un título en blanco', () => {
    expect(() => validarTituloObjetivo('   ')).toThrow();
  });

  it('rechaza una fecha límite en blanco', () => {
    expect(() => validarFechaLimite('   ', '2026-01-01')).toThrow();
  });

  it('rechaza una fecha límite que no es una fecha ISO válida', () => {
    expect(() => validarFechaLimite('zzzz', '2026-10-04')).toThrow(/no es una fecha válida/);
    expect(() => validarFechaLimite('2026-02-30', '2026-10-04')).toThrow(/no es una fecha válida/);
    expect(() => validarFechaLimite('2026-13-01', '2026-10-04')).toThrow(/no es una fecha válida/);
  });

  it('admite una fecha límite igual a hoy (fecha límite ≥ hoy)', () => {
    expect(validarFechaLimite('2026-10-04', '2026-10-04')).toBe('2026-10-04');
  });

  it('rechaza una fecha límite en el pasado (fecha límite ≥ hoy)', () => {
    expect(() => validarFechaLimite('2026-10-03', '2026-10-04')).toThrow(
      /no puede estar en el pasado/,
    );
  });
});

describe('crearObjetivoEnCurso', () => {
  it('nace en curso con sus campos', () => {
    expect(crearObjetivoEnCurso('Certificar en AWS', 'Examen', '2026-12-31')).toEqual({
      titulo: 'Certificar en AWS',
      descripcion: 'Examen',
      fechaLimite: '2026-12-31',
      estado: 'en curso',
    });
  });
});

describe('transiciones de estado del objetivo', () => {
  it('en curso → cumplido', () => {
    expect(transicionarEstado(enCurso(), 'cumplido').estado).toBe('cumplido');
  });

  it('en curso → no cumplido', () => {
    expect(transicionarEstado(enCurso(), 'no cumplido').estado).toBe('no cumplido');
  });

  it('no revive un objetivo cumplido a en curso', () => {
    const cumplido: Objetivo = { ...enCurso(), estado: 'cumplido' };
    expect(() => transicionarEstado(cumplido, 'en curso')).toThrow(/no puede cambiar de estado/);
  });

  it('no mueve un objetivo cumplido a no cumplido', () => {
    const cumplido: Objetivo = { ...enCurso(), estado: 'cumplido' };
    expect(() => transicionarEstado(cumplido, 'no cumplido')).toThrow(/no puede cambiar de estado/);
  });

  it('no revive un objetivo no cumplido', () => {
    const noCumplido: Objetivo = { ...enCurso(), estado: 'no cumplido' };
    expect(() => transicionarEstado(noCumplido, 'en curso')).toThrow(/no puede cambiar de estado/);
  });

  it('rechaza un estado de destino distinto de cumplido/no cumplido', () => {
    expect(() => transicionarEstado(enCurso(), 'en curso' as EstadoObjetivo)).toThrow(
      /Estado de destino no válido/,
    );
  });
});

describe('editarObjetivo', () => {
  it('edita un objetivo en curso', () => {
    const editado = editarObjetivo(enCurso(), {
      titulo: 'Certificar en Azure',
      descripcion: 'Examen AZ-104',
      fechaLimite: '2026-11-30',
    });

    expect(editado).toEqual({
      id: 'o-1',
      menteeId: 'me-1',
      titulo: 'Certificar en Azure',
      descripcion: 'Examen AZ-104',
      fechaLimite: '2026-11-30',
      estado: 'en curso',
    });
  });

  it('no edita un objetivo cerrado', () => {
    const cumplido: Objetivo = { ...enCurso(), estado: 'cumplido' };
    expect(() =>
      editarObjetivo(cumplido, { titulo: 'Otro', descripcion: '', fechaLimite: '2026-12-01' }),
    ).toThrow(/no puede editarse/);
  });
});

describe('ObjetivoService', () => {
  const objetivo: Objetivo = enCurso();

  function fakeRepository(): ObjetivoRepository {
    return {
      async objetivosOf(managerId, menteeId) {
        expect(managerId).toBe('m-1');
        expect(menteeId).toBe('me-1');
        return [objetivo];
      },
      async addObjetivo(managerId, nuevo) {
        expect(managerId).toBe('m-1');
        return { id: 'o-1', ...nuevo, estado: 'en curso' };
      },
      async updateObjetivo(managerId, objetivoId, cambios) {
        expect(managerId).toBe('m-1');
        expect(objetivoId).toBe('o-1');
        return { ...objetivo, ...cambios };
      },
      async cambiarEstado(managerId, objetivoId, estado) {
        expect(managerId).toBe('m-1');
        expect(objetivoId).toBe('o-1');
        return { ...objetivo, estado };
      },
    };
  }

  it('lista los objetivos de la mentee del manager', async () => {
    const service = new ObjetivoService(fakeRepository());

    await expect(service.objetivosOf(manager, 'me-1')).resolves.toEqual([objetivo]);
  });

  it('da de alta un objetivo con título y fecha recortados', async () => {
    const service = new ObjetivoService(fakeRepository());

    await expect(
      service.addObjetivo(manager, {
        menteeId: 'me-1',
        titulo: '  Certificar en AWS  ',
        descripcion: '  Examen  ',
        fechaLimite: '  2026-12-31  ',
      }),
    ).resolves.toMatchObject({
      titulo: 'Certificar en AWS',
      descripcion: 'Examen',
      fechaLimite: '2026-12-31',
      estado: 'en curso',
    });
  });

  it('rechaza un título vacío sin llegar al repositorio', async () => {
    let llamado = false;
    const repo: ObjetivoRepository = {
      async objetivosOf() {
        return [];
      },
      async addObjetivo() {
        llamado = true;
        return objetivo;
      },
      async updateObjetivo() {
        return objetivo;
      },
      async cambiarEstado() {
        return objetivo;
      },
    };
    const service = new ObjetivoService(repo);

    await expect(
      service.addObjetivo(manager, {
        menteeId: 'me-1',
        titulo: '   ',
        descripcion: '',
        fechaLimite: '2026-12-31',
      }),
    ).rejects.toThrow();
    expect(llamado).toBe(false);
  });

  it('edita y cambia el estado delegando en el repositorio', async () => {
    const service = new ObjetivoService(fakeRepository());

    await expect(
      service.updateObjetivo(manager, 'o-1', {
        titulo: 'Certificar en Azure',
        descripcion: '',
        fechaLimite: '2026-11-30',
      }),
    ).resolves.toMatchObject({ titulo: 'Certificar en Azure' });

    await expect(service.cambiarEstado(manager, 'o-1', 'cumplido')).resolves.toMatchObject({
      estado: 'cumplido',
    });
  });

  it('rechaza dar de alta un objetivo con la fecha límite en el pasado', async () => {
    let llamado = false;
    const repo: ObjetivoRepository = {
      async objetivosOf() {
        return [];
      },
      async addObjetivo() {
        llamado = true;
        return objetivo;
      },
      async updateObjetivo() {
        return objetivo;
      },
      async cambiarEstado() {
        return objetivo;
      },
    };
    const service = new ObjetivoService(repo);

    await expect(
      service.addObjetivo(
        manager,
        { menteeId: 'me-1', titulo: 'Certificar en AWS', descripcion: '', fechaLimite: '2026-10-03' },
        '2026-10-04',
      ),
    ).rejects.toThrow(/no puede estar en el pasado/);
    expect(llamado).toBe(false);
  });

  it('rechaza editar un objetivo con la fecha límite en el pasado', async () => {
    let llamado = false;
    const repo: ObjetivoRepository = {
      async objetivosOf() {
        return [];
      },
      async addObjetivo() {
        return objetivo;
      },
      async updateObjetivo() {
        llamado = true;
        return objetivo;
      },
      async cambiarEstado() {
        return objetivo;
      },
    };
    const service = new ObjetivoService(repo);

    await expect(
      service.updateObjetivo(
        manager,
        'o-1',
        { titulo: 'Certificar en AWS', descripcion: '', fechaLimite: '2026-09-30' },
        '2026-10-04',
      ),
    ).rejects.toThrow(/no puede estar en el pasado/);
    expect(llamado).toBe(false);
  });
});