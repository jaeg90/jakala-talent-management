import type { EstadoTemaPropio, TemaPropio } from './model.js';

/**
 * Regla de dominio: el nombre de un tema propio, una vez recortado, no puede
 * estar vacío. Devuelve el nombre ya recortado para su alta.
 */
export function validarNombreTemaPropio(tema: string): string {
  const nombre = tema.trim();
  if (nombre === '') throw new Error('El nombre del tema no puede estar vacío');
  return nombre;
}

/**
 * Clave de comparación de un nombre de tema: minúsculas y sin tildes. El alta de
 * un tema propio compara así (spec §14): «formación», «FORMACIÓN» y «formación
 * en curso» no colisionan, pero «formación» y «FORMACIÓN» sí.
 */
export function normalizarNombreTema(tema: string): string {
  return tema
    .normalize('NFD')
    .replace(/\p{M}/gu, '')
    .toLocaleLowerCase('es');
}

/**
 * Regla de dominio: un tema propio no puede duplicar (sin mayúsculas ni tildes)
 * otro tema propio vigente, otro tema propio retirado ni un tema genérico vigente
 * de la plantilla del manager. Lanza con el copy exacto de spec §14 para cada
 * caso. Las notas de un 1-to-1 se persisten por nombre de tema (`UNIQUE(onetoone_id,
 * tema)`): el duplicado es imposible por contrato, no solo desaconsejado.
 */
export function validarSinDuplicadosTemaPropio(
  nombre: string,
  propios: TemaPropio[],
  genericosVigentes: { tema: string }[],
  primerNombreMentee: string,
): void {
  const clave = normalizarNombreTema(nombre);
  const propioVigente = propios.find(
    (p) => p.estado === 'vigente' && normalizarNombreTema(p.tema) === clave,
  );
  if (propioVigente !== undefined) {
    throw new Error(`${primerNombreMentee} ya tiene un tema propio con ese nombre.`);
  }
  const propioRetirado = propios.find(
    (p) => p.estado === 'retirado' && normalizarNombreTema(p.tema) === clave,
  );
  if (propioRetirado !== undefined) {
    throw new Error('Ya lo tienes en retirados. Pulsa «Volver a usar».');
  }
  const generico = genericosVigentes.find(
    (g) => normalizarNombreTema(g.tema) === clave,
  );
  if (generico !== undefined) {
    throw new Error('Tu plantilla ya tiene un tema con ese nombre.');
  }
}

/** Primer nombre de una persona («Ana Alonso» → «Ana»), para el copy de §14. */
export function primerNombre(nombre: string): string {
  return nombre.trim().split(/\s+/)[0] ?? nombre;
}

/** Marca un tema propio como retirado (fecha de hoy, sin borrado físico). */
export function retirarTemaPropio(
  tema: TemaPropio,
  hoy: string,
): { estado: EstadoTemaPropio; retiradoEl: string | null } {
  if (tema.estado !== 'vigente') {
    return { estado: tema.estado, retiradoEl: tema.retiradoEl };
  }
  return { estado: 'retirado', retiradoEl: hoy };
}