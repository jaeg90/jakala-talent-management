import { describe, expect, it } from 'vitest';
import { crearPasada, fronteraDe, paso, resultado } from '../src/domain/maquina.js';
import type { Pasada, Ticket } from '../src/domain/model.js';

/**
 * La frontera de esta mañana, la misma que validó el prototipo
 * (rama prototipo/piloto-loop-estados): #4 y #8 desbloqueados;
 * #5–#7 bloqueados por #4; #3 ya cerrado.
 */
function ticketsDePrueba(): Ticket[] {
  return [
    { numero: 3, titulo: 'Ticket 2: Mi equipo', cuerpo: '', estado: 'cerrado', bloqueadoPor: [] },
    { numero: 4, titulo: 'Ticket 3: Ficha de mentee y 1-to-1s', cuerpo: 'Spec del ticket 3.', estado: 'lista', bloqueadoPor: [] },
    { numero: 5, titulo: 'Ticket 4: Temas propios', cuerpo: 'Spec del ticket 4.', estado: 'lista', bloqueadoPor: [4] },
    { numero: 6, titulo: 'Ticket 5: Objetivos anuales', cuerpo: 'Spec del ticket 5.', estado: 'lista', bloqueadoPor: [4] },
    { numero: 7, titulo: 'Ticket 6: Incidencias', cuerpo: 'Spec del ticket 6.', estado: 'lista', bloqueadoPor: [4] },
    { numero: 8, titulo: 'Ticket 7: Catálogo de proyectos', cuerpo: 'Spec del ticket 7.', estado: 'lista', bloqueadoPor: [3] },
  ];
}

describe('Núcleo: la frontera', () => {
  it('solo contiene tickets listos y desbloqueados, ordenados por número', () => {
    const pasada = crearPasada({ reintentos: 3, tickets: ticketsDePrueba() });

    expect(fronteraDe(pasada).map((t) => t.numero)).toEqual([4, 8]);
  });

  it('un paso en la frontera elige el de menor número y lanza la implementadora', () => {
    const pasada = crearPasada({ reintentos: 3, tickets: ticketsDePrueba() });

    const { pasada: siguiente, comandos } = paso(pasada);

    expect(siguiente.fase).toBe('implementación');
    expect(siguiente.ticketActual).toBe(4);
    expect(siguiente.reintentosUsados).toBe(0);
    expect(siguiente.error).toBeNull();
    expect(comandos).toEqual([
      { tipo: 'lanzarImplementadora', ticket: expect.objectContaining({ numero: 4 }) },
    ]);
    expect(siguiente.narracion.at(-1)).toMatch(/Elijo #4/);
  });
});

/** Lleva la pasada hasta la fase indicada con eventos de éxito. */
function hasta(fase: 'revisión' | 'puertas' | 'verde'): Pasada {
  let pasada = paso(crearPasada({ reintentos: 3, tickets: ticketsDePrueba() })).pasada;
  if (fase === 'revisión') return resultado(pasada, { tipo: 'diffListo', resumen: 'Ficha con acuerdos.' }).pasada;
  pasada = resultado(pasada, { tipo: 'diffListo', resumen: 'Ficha con acuerdos.' }).pasada;
  if (fase === 'puertas') return resultado(pasada, { tipo: 'revisiónSinHallazgos' }).pasada;
  pasada = resultado(pasada, { tipo: 'revisiónSinHallazgos' }).pasada;
  return resultado(pasada, { tipo: 'puertasEnVerde' }).pasada;
}

describe('Núcleo: el ciclo de un ticket', () => {
  it('un diff listo guarda el resumen y lanza la revisora', () => {
    const enImplementacion = paso(crearPasada({ reintentos: 3, tickets: ticketsDePrueba() })).pasada;

    const mov = resultado(enImplementacion, { tipo: 'diffListo', resumen: 'Añadida la ficha con acuerdos.' });

    expect(mov.pasada.fase).toBe('revisión');
    expect(mov.pasada.resumen).toBe('Añadida la ficha con acuerdos.');
    expect(mov.comandos).toEqual([
      { tipo: 'lanzarRevisora', ticket: expect.objectContaining({ numero: 4 }) },
    ]);
  });

  it('una revisión sin hallazgos abre las puertas', () => {
    const mov = resultado(hasta('revisión'), { tipo: 'revisiónSinHallazgos' });

    expect(mov.pasada.fase).toBe('puertas');
    expect(mov.comandos).toEqual([{ tipo: 'abrirPuertas' }]);
  });

  it('las puertas en verde llevan a verde; el paso empuja, cierra y desbloquea', () => {
    const enVerde = hasta('verde');

    expect(enVerde.fase).toBe('verde');

    const { pasada: siguiente, comandos } = paso(enVerde);

    expect(siguiente.fase).toBe('frontera');
    expect(siguiente.tickets.find((t) => t.numero === 4)?.estado).toBe('cerrado');
    expect(comandos).toEqual([
      { tipo: 'empujarYCerrar', ticket: expect.objectContaining({ numero: 4 }), resumen: 'Ficha con acuerdos.' },
    ]);
    expect(fronteraDe(siguiente).map((t) => t.numero)).toEqual([5, 6, 7, 8]);
  });
});

/** Lleva la pasada a rojo con un hallazgo de la revisión sobre el ticket #4. */
function enRojo(reintentos: number): Pasada {
  let pasada = paso(crearPasada({ reintentos, tickets: ticketsDePrueba() })).pasada;
  pasada = resultado(pasada, { tipo: 'diffListo', resumen: 'Ficha con acuerdos.' }).pasada;
  return resultado(pasada, { tipo: 'revisiónConHallazgo', texto: 'Falta la persistencia de los temas.' }).pasada;
}

describe('Núcleo: rojo, reintentos y escalado', () => {
  it('un hallazgo de la revisión fuerza rojo con el hallazgo como error', () => {
    const mov = resultado(hasta('revisión'), {
      tipo: 'revisiónConHallazgo',
      texto: 'Falta la persistencia de los temas.',
    });

    expect(mov.pasada.fase).toBe('rojo');
    expect(mov.pasada.error).toEqual({ origen: 'revisión', texto: 'Falta la persistencia de los temas.' });
    expect(mov.pasada.narracion.at(-1)).toMatch(/solo puede forzar rojo/);
  });

  it('una puerta en rojo fuerza rojo con su salida como error', () => {
    const mov = resultado(hasta('puertas'), {
      tipo: 'puertaEnRojo',
      puerta: 'tests',
      salida: 'expected true, received false',
    });

    expect(mov.pasada.fase).toBe('rojo');
    expect(mov.pasada.error).toEqual({ origen: 'puerta', puerta: 'tests', texto: 'expected true, received false' });
  });

  it('el paso en rojo lanza una reparadora nueva con el error (reintento 1 de 2)', () => {
    const mov = paso(enRojo(2));

    expect(mov.pasada.fase).toBe('reparación');
    expect(mov.pasada.reintentosUsados).toBe(1);
    expect(mov.comandos).toEqual([
      {
        tipo: 'lanzarReparadora',
        ticket: expect.objectContaining({ numero: 4 }),
        reintento: 1,
        reintentosConfigurados: 2,
        error: { origen: 'revisión', texto: 'Falta la persistencia de los temas.' },
      },
    ]);
  });

  it('el parche de la reparadora vuelve siempre a la revisión', () => {
    const enReparacion = paso(enRojo(2)).pasada;

    const mov = resultado(enReparacion, { tipo: 'parcheListo' });

    expect(mov.pasada.fase).toBe('revisión');
    expect(mov.comandos).toEqual([
      { tipo: 'lanzarRevisora', ticket: expect.objectContaining({ numero: 4 }) },
    ]);
  });

  it('un rojo con los reintentos agotados escala, y el escalado detiene la pasada', () => {
    let pasada = paso(enRojo(2)).pasada;
    pasada = resultado(pasada, { tipo: 'parcheListo' }).pasada;
    pasada = resultado(pasada, { tipo: 'revisiónConHallazgo', texto: 'Sigue igual.' }).pasada;
    pasada = paso(pasada).pasada;
    pasada = resultado(pasada, { tipo: 'parcheListo' }).pasada;
    pasada = resultado(pasada, { tipo: 'revisiónConHallazgo', texto: 'El parche rompe otra cosa.' }).pasada;

    const escalado = paso(pasada);

    expect(escalado.pasada.fase).toBe('escalado');
    expect(escalado.pasada.tickets.find((t) => t.numero === 4)?.estado).toBe('escalado');
    expect(escalado.comandos).toEqual([
      {
        tipo: 'escalar',
        ticket: expect.objectContaining({ numero: 4 }),
        error: expect.objectContaining({ texto: 'El parche rompe otra cosa.' }),
      },
    ]);
    expect(escalado.pasada.narracion.at(-1)).toMatch(/Me detengo: no paso al siguiente ticket/);

    const fin = paso(escalado.pasada);

    expect(fin.pasada.fase).toBe('fin');
    expect(fin.comandos).toEqual([{ tipo: 'terminar', motivo: 'escalado', abiertos: [4, 5, 6, 7, 8] }]);
  });

  it('con N=0 el primer rojo escala directo, sin reparadoras', () => {
    const mov = paso(enRojo(0));

    expect(mov.pasada.fase).toBe('escalado');
    expect(mov.pasada.reintentosUsados).toBe(0);
    expect(mov.comandos[0]?.tipo).toBe('escalar');
  });

  it('un ticket escalado no desbloquea a sus bloqueados', () => {
    const escalado = paso(enRojo(0)).pasada;

    expect(fronteraDe(escalado).map((t) => t.numero)).toEqual([8]);
  });
});

describe('Núcleo: resultados inesperados y fin de pasada', () => {
  it('un evento que no corresponde a la fase se ignora: mismo estado, solo narración', () => {
    const enRevision = hasta('revisión');

    const mov = resultado(enRevision, { tipo: 'puertasEnVerde' });

    expect(mov.pasada.fase).toBe('revisión');
    const { narracion: _antes, ...estadoAntes } = enRevision;
    const { narracion: _despues, ...estadoDespues } = mov.pasada;
    expect(estadoDespues).toEqual(estadoAntes);
    expect(mov.pasada.narracion.length).toBe(enRevision.narracion.length + 1);
  });

  it('nadie refuta una puerta en rojo: un verde posterior se ignora', () => {
    const enPuertas = hasta('puertas');
    const rojo = resultado(enPuertas, { tipo: 'puertaEnRojo', puerta: 'tests', salida: 'fallo' }).pasada;

    const mov = resultado(rojo, { tipo: 'puertasEnVerde' });

    expect(mov.pasada.fase).toBe('rojo');
    expect(mov.pasada.narracion.at(-1)).toMatch(/Lo ignoro/);
  });

  it('un paso en fase de espera no decide nada', () => {
    const mov = paso(hasta('revisión'));

    expect(mov.comandos).toEqual([]);
    expect(mov.pasada.fase).toBe('revisión');
  });

  it('la frontera vacía termina la pasada', () => {
    const mov = paso(crearPasada({ reintentos: 3, tickets: [] }));

    expect(mov.pasada.fase).toBe('fin');
    expect(mov.comandos).toEqual([{ tipo: 'terminar', motivo: 'fronteraVacia', abiertos: [] }]);
  });
});
