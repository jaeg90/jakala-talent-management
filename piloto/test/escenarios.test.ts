import { describe, expect, it } from 'vitest';
import { correrPasada } from '../src/application/pasada.js';
import { ESCENARIOS, elegirModo } from '../src/infrastructure/escenarios.js';
import { crearPuertosSimulados } from '../src/infrastructure/simulacion.js';

const ETIQUETA_ESCALADO = 'ready-for-human';
const ETIQUETA_DEVOLUCIÓN = 'needs-grill';
const ETIQUETA_LISTA = 'ready-for-agent';
const ETIQUETAS = { lista: ETIQUETA_LISTA, escalado: ETIQUETA_ESCALADO, devolución: ETIQUETA_DEVOLUCIÓN };
const REINTENTOS = 4;

describe('elegirModo', () => {
  it('sin --simular es real', () => {
    expect(elegirModo([])).toEqual({ tipo: 'real' });
    expect(elegirModo(['--otro'])).toEqual({ tipo: 'real' });
  });

  it('--simular sin nombre es el escenario feliz', () => {
    expect(elegirModo(['--simular'])).toEqual({ tipo: 'simulado', nombre: 'feliz' });
  });

  it('--simular=<nombre válido> elige ese escenario', () => {
    expect(elegirModo(['--simular=escalado'])).toEqual({ tipo: 'simulado', nombre: 'escalado' });
  });

  it('--simular=<desconocido> es error y lista los escenarios', () => {
    const modo = elegirModo(['--simular=inventado']);
    expect(modo.tipo).toBe('error');
    if (modo.tipo !== 'error') return;
    expect(modo.mensaje).toContain('Escenario desconocido: «inventado». Escenarios disponibles:');
    expect(modo.mensaje).toContain('feliz');
    expect(modo.mensaje).toContain('reparacion');
    expect(modo.mensaje).toContain('puerta-roja');
    expect(modo.mensaje).toContain('escalado');
    expect(modo.mensaje).toContain('devolucion-revisora');
    expect(modo.mensaje).toContain('devolucion-implementadora');
  });
});

describe('ESCENARIOS: cada guion produce el desenlace de su descripción', () => {
  it('feliz: se cierra la frontera entera, sin reparaciones ni avisos', async () => {
    const { puertos, registro } = crearPuertosSimulados(ESCENARIOS.feliz.guion);
    await correrPasada(puertos, { reintentos: REINTENTOS, etiquetas: ETIQUETAS }, () => {});
    expect(registro.cierres.map((c) => c.ticket)).toEqual([4, 5, 6, 7, 8]);
    expect(registro.reparaciones).toEqual([]);
    expect(registro.avisos).toEqual([]);
  });

  it('reparacion: una reparación del primer ticket y todos cierran', async () => {
    const { puertos, registro } = crearPuertosSimulados(ESCENARIOS.reparacion.guion);
    await correrPasada(puertos, { reintentos: REINTENTOS, etiquetas: ETIQUETAS }, () => {});
    expect(registro.cierres.map((c) => c.ticket)).toEqual([4, 5, 6, 7, 8]);
    expect(registro.reparaciones).toEqual([1]);
  });

  it('puerta-roja: la puerta en rojo dispara una reparación y todos cierran', async () => {
    const { puertos, registro } = crearPuertosSimulados(ESCENARIOS['puerta-roja'].guion);
    await correrPasada(puertos, { reintentos: REINTENTOS, etiquetas: ETIQUETAS }, () => {});
    expect(registro.cierres.map((c) => c.ticket)).toEqual([4, 5, 6, 7, 8]);
    expect(registro.reparaciones).toEqual([1]);
  });

  it('escalado: agota los reintentos, escala #4 y detiene la pasada sin cierres', async () => {
    const { puertos, registro } = crearPuertosSimulados(ESCENARIOS.escalado.guion);
    await correrPasada(puertos, { reintentos: REINTENTOS, etiquetas: ETIQUETAS }, () => {});
    expect(registro.etiquetados).toEqual([{ ticket: 4, etiqueta: ETIQUETA_ESCALADO }]);
    expect(registro.cierres).toEqual([]);
    expect(registro.avisos).toHaveLength(1);
    expect(registro.reparaciones).toEqual([1, 2, 3, 4]);
  });

  it('devolucion-revisora: la duda devuelve #4 con needs-grill, sin cierres ni reparaciones', async () => {
    const { puertos, registro } = crearPuertosSimulados(ESCENARIOS['devolucion-revisora'].guion);
    await correrPasada(puertos, { reintentos: REINTENTOS, etiquetas: ETIQUETAS }, () => {});
    expect(registro.etiquetados).toEqual([{ ticket: 4, etiqueta: ETIQUETA_DEVOLUCIÓN }]);
    expect(registro.cierres).toEqual([]);
    expect(registro.reparaciones).toEqual([]);
  });

  it('devolucion-implementadora: la implementadora devuelve #4 sin gastar revisión', async () => {
    const { puertos, registro } = crearPuertosSimulados(ESCENARIOS['devolucion-implementadora'].guion);
    await correrPasada(puertos, { reintentos: REINTENTOS, etiquetas: ETIQUETAS }, () => {});
    expect(registro.etiquetados).toEqual([{ ticket: 4, etiqueta: ETIQUETA_DEVOLUCIÓN }]);
    expect(registro.cierres).toEqual([]);
    expect(registro.reparaciones).toEqual([]);
  });
});