import { describe, expect, it } from 'vitest';
import { correrPasada } from '../src/application/pasada.js';
import { crearPuertosSimulados } from '../src/infrastructure/simulacion.js';
import type { Ticket } from '../src/domain/model.js';

const ETIQUETA_ESCALADO = 'ready-for-human';
const ETIQUETA_DEVOLUCIÓN = 'needs-grill';
const CONFIG = {
  reintentos: 3,
  etiquetas: { lista: 'ready-for-agent', escalado: ETIQUETA_ESCALADO, devolución: ETIQUETA_DEVOLUCIÓN },
};

function ticket(numero: number, titulo: string, bloqueadoPor: number[] = []): Ticket {
  return { numero, titulo, cuerpo: `Spec de ${titulo}.`, estado: 'lista', bloqueadoPor, tipo: null };
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
      { reintentos: 1, etiquetas: { lista: 'ready-for-agent', escalado: ETIQUETA_ESCALADO, devolución: ETIQUETA_DEVOLUCIÓN } },
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

  it('una duda de la revisora devuelve el ticket: needs-grill, comentario con dudas y hallazgos, y pasada detenida', async () => {
    const tickets = [ticket(4, 'Ficha'), ticket(8, 'Proyectos')];
    const { puertos, registro } = crearPuertosSimulados({
      tickets,
      hallazgos: ['El avatar solo tiene el tamaño 28px.'],
      dudas: [['¿«tarjeta 420px» es ancho total o de contenido?']],
      rojos: [null],
    });
    const narracion: string[] = [];

    const pasada = await correrPasada(puertos, CONFIG, (linea) => narracion.push(linea));

    expect(pasada.fase).toBe('fin');
    expect(registro.etiquetados).toEqual([{ ticket: 4, etiqueta: ETIQUETA_DEVOLUCIÓN }]);
    expect(registro.comentarios).toHaveLength(1);
    expect(registro.comentarios[0]?.texto).toMatch(/420px/);
    expect(registro.comentarios[0]?.texto).toMatch(/El avatar solo tiene el tamaño 28px/);
    expect(registro.avisos).toHaveLength(1);
    expect(registro.reparaciones).toEqual([]);
    expect(registro.cierres).toEqual([]);
    expect(registro.empujes).toEqual([]);
    expect(narracion.some((l) => l.includes('sesión de grill'))).toBe(true);
  });

  it('la implementadora que devuelve detiene la pasada sin gastar revisión ni reintentos', async () => {
    const tickets = [ticket(4, 'Ficha'), ticket(8, 'Proyectos')];
    const { puertos, registro } = crearPuertosSimulados({
      tickets,
      hallazgos: [null],
      devoluciones: ['¿El alta notifica por email o solo con un aviso en la app?'],
      rojos: [null],
    });

    const pasada = await correrPasada(puertos, CONFIG, () => {});

    expect(pasada.fase).toBe('fin');
    expect(registro.etiquetados).toEqual([{ ticket: 4, etiqueta: ETIQUETA_DEVOLUCIÓN }]);
    expect(registro.comentarios[0]?.texto).toMatch(/email o solo con un aviso/);
    expect(registro.reparaciones).toEqual([]);
    expect(registro.cierres).toEqual([]);
  });

  it('la frontera vacía termina la pasada sin efectos', async () => {
    const { puertos, registro } = crearPuertosSimulados({ tickets: [], hallazgos: [null], rojos: [null] });

    const pasada = await correrPasada(puertos, CONFIG, () => {});

    expect(pasada.fase).toBe('fin');
    expect(registro.cierres).toEqual([]);
    expect(registro.empujes).toEqual([]);
  });
});
