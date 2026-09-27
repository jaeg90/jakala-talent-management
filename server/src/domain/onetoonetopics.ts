/** Nota tomada sobre un tema en un 1-to-1. */
export interface NotaPorTema {
  tema: string;
  nota: string;
}

/**
 * Regla de dominio: a lo sumo una nota por tema en cada 1-to-1.
 * Lanza si dos notas comparten tema.
 */
export function validarNotasPorTema(notas: NotaPorTema[]): void {
  const vistos = new Set<string>();
  for (const { tema } of notas) {
    if (vistos.has(tema)) {
      throw new Error(`Tema duplicado en el 1-to-1: ${tema}`);
    }
    vistos.add(tema);
  }
}
