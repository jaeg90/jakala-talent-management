/**
 * Stryker (mutation testing) sobre el dominio de JTM.
 * Genera mutantes de las reglas puras del dominio y mide cuántos mueren con los
 * tests unitarios. El umbral `break` fija el máximo de mutantes sobrevivientes
 * tolerados: si el umbral no se cumple, Stryker sale con código distinto de 0.
 * Ver docs/adr/0005-arnes-de-calidad.md y AGENTS.md.
 */
export default {
  packageManager: 'npm',
  testRunner: 'vitest',
  vitest: {
    configFile: 'vitest.config.ts',
  },
  // El mutador se elige por la extensión de los archivos mutados (TypeScript);
  // Stryker 10 ya no requiere declarar "mutator" como string.
  reporters: ['clear-text', 'html', 'json', 'progress'],
  // El vitest-runner selecciona por sí mismo los tests relacionados (related mode).
  coverageAnalysis: 'off',
  // Solo las reglas puras del dominio; se excluyen los archivos de solo tipos.
  mutate: ['src/domain/**/*.ts', '!src/domain/model.ts', '!src/domain/ports.ts'],
  thresholds: {
    high: 95,
    low: 85,
    // Umbral de mutantes sobrevivientes: puntuación de mutación mínima exigida.
    break: 85,
  },
  timeoutMS: 30_000,
};