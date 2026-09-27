import { describe, expect, it } from 'vitest';
import { correrPasada } from '../src/application/pasada.js';
import { crearPuertosSimulados } from '../src/infrastructure/simulacion.js';
import type { Ticket } from '../src/domain/model.js';

const ETIQUETA_ESCALADO = 'ready-for-human';
const CONFIG = { reintentos: 3, etiquetaEscalado: ETIQUETA_ESCALADO };

function ticket(numero: number, titulo: string, bloqueadoPor: number[] = []): Ticket {
  return { numero, titulo, cuerpo: `Spec de ${titulo}.`, estado: 'lista', bloqueadoPor };
}

describe('Pasada: el loop completo contra puertos simulados', () => {
  it('verde a la primera: procesa la frontera en orden y termina sola', async () => {
    const tickets = [ticket(4, 'Ficha'), ticket(5, 'Temas propios', [4]), ticket(8, 'Proyectos')];
    const { puertos, registro } = crearPuertosSimulados({ tickets, hallazgos: [null], rojos: [null] });
    const narracion: string[] = [];

    const pasada = await correrPasada(puertos, CONFIG, (linea) => narracion.push(linea));

    expect(registro.cierres.map((c) => c.ticket)).toEqual([4, 5, 8]);
    expect(registro.empujes).toEqual([4, 5, 8]);
    expect(registro.avisos).toEqual([]);
    expect(pasada.fase).toBe('fin');
    expect(narracion.some((l) => l.includes('Elijo #4'))).toBe(true);
  });

  it('un rojo lanza una reparadora y el parche vuelve a revisión hasta el verde', async () => {
    const tickets = [ticket(4, 'Ficha')];
    const { puertos, registro } = crearPuertosSimulados({
      tickets,
      hallazgos: ['Falta persistir los temas propios.', null],
      rojos: [null],
    });

    const pasada = await correrPasada(puertos, CONFIG, () => {});

    expect(registro.reparaciones).toEqual([1]);
    expect(registro.cierres).toEqual([{ ticket: 4, resumen: 'Implementado: Ficha.' }]);
    expect(pasada.fase).toBe('fin');
  });

  it('agotados los reintentos: escala, avisa y detiene la pasada sin tocar el resto', async () => {
    const tickets = [ticket(4, 'Ficha'), ticket(8, 'Proyectos')];
    const { puertos, registro } = crearPuertosSimulados({ tickets, hallazgos: ['mal'], rojos: [null] });
    const narracion: string[] = [];

    const pasada = await correrPasada(
      puertos,
      { reintentos: 1, etiquetaEscalado: ETIQUETA_ESCALADO },
      (linea) => narracion.push(linea),
    );

    expect(pasada.fase).toBe('fin');
    expect(registro.etiquetados).toEqual([{ ticket: 4, etiqueta: ETIQUETA_ESCALADO }]);
    expect(registro.comentarios).toHaveLength(1);
    expect(registro.comentarios[0]?.texto).toMatch(/mal/);
    expect(registro.avisos).toHaveLength(1);
    expect(registro.reparaciones).toEqual([1]);
    expect(registro.cierres).toEqual([]);
    expect(registro.empujes).toEqual([]);
    expect(narracion.some((l) => l.includes('Me detengo'))).toBe(true);
  });

  it('la frontera vacía termina la pasada sin efectos', async () => {
    const { puertos, registro } = crearPuertosSimulados({ tickets: [], hallazgos: [null], rojos: [null] });

    const pasada = await correrPasada(puertos, CONFIG, () => {});

    expect(pasada.fase).toBe('fin');
    expect(registro.cierres).toEqual([]);
    expect(registro.empujes).toEqual([]);
  });
});
