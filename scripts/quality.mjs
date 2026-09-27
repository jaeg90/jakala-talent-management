/**
 * Arnés de calidad completo de JTM (ver AGENTS.md): Stryker (mutation testing),
 * SonarQube (calidad estática), trazas OpenTelemetry y errores de Sentry.
 *
 * Ejecuta las cuatro puertas y resume el estado. Salida:
 *   0 = verde (todo pasa; los saltos se muestran pero no bloquean),
 *   1 = rojo (alguna puerta ha fallado).
 */
import { spawnSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));

/** Ejecuta un script npm y devuelve su código de salida (null → 1). */
function run(label, scriptName) {
  console.log(`\n▶ ${label}`);
  // shell:true resuelve `npm` (el .cmd de Windows) de forma fiable en todas las plataformas.
  const res = spawnSync(`npm run ${scriptName}`, { cwd: root, stdio: 'inherit', shell: true });
  return res.status ?? 1;
}

/** Métricas de mutación desde el informe JSON de Stryker (reports/mutation). */
function strykerMetrics() {
  try {
    const path = join(root, 'server', 'reports', 'mutation', 'mutation.json');
    const report = JSON.parse(readFileSync(path, 'utf8'));
    let total = 0;
    let killed = 0;
    let timeout = 0;
    let survived = 0;
    let noCoverage = 0;
    for (const file of Object.values(report.files ?? {})) {
      for (const mutant of file.mutants) {
        total += 1;
        if (mutant.status === 'Killed') killed += 1;
        else if (mutant.status === 'Timeout') timeout += 1;
        else if (mutant.status === 'Survived') survived += 1;
        else if (mutant.status === 'NoCoverage') noCoverage += 1;
      }
    }
    const score = total === 0 ? 100 : ((killed + timeout) / total) * 100;
    return { total, killed, timeout, survived, noCoverage, score };
  } catch {
    return null;
  }
}

const resultados = [];

function add(name, code, detail) {
  const status = code === 0 ? 'PASS' : code === 2 ? 'SKIP' : 'FAIL';
  resultados.push({ name, status, detail });
}

// 1. Stryker (mutation testing sobre el dominio).
const strykerCode = run('Stryker — mutation testing del dominio', 'test:mutation');
const metrics = strykerMetrics();
add(
  'Stryker',
  strykerCode,
  metrics ? `${metrics.score.toFixed(2)}% mutación (${metrics.survived} sobrevivientes de ${metrics.total})` : 'sin informe',
);

// 2. SonarQube (0 = PASS, 2 = SKIP, otro = FAIL). El propio script imprime su estado.
const sonarCode = run('SonarQube — calidad estática', 'sonar');
add('SonarQube', sonarCode, sonarCode === 2 ? 'servidor o token no disponibles' : 'análisis completado');

// 3. Y 4. Trazas OpenTelemetry y errores de Sentry (smoke tests deterministas).
const otelCode = run('OpenTelemetry — trazas de la API', 'test:otel');
add('OpenTelemetry', otelCode, 'trazas generadas por peticiones a la API');

const sentryCode = run('Sentry — errores de servidor y cliente', 'test:sentry');
add('Sentry', sentryCode, 'error simulado entregado al DSN por entorno');

// Resumen.
console.log('\n════════════════════════════════════════');
console.log('Arnés de calidad — resumen');
console.log('────────────────────────────────────────');
let verde = true;
for (const r of resultados) {
  const marca = r.status === 'PASS' ? '✓' : r.status === 'SKIP' ? '○' : '✗';
  console.log(` ${marca} ${r.name.padEnd(16)} ${r.status.padEnd(5)} ${r.detail}`);
  if (r.status === 'FAIL') verde = false;
}
console.log('────────────────────────────────────────');
console.log(verde ? 'Estado: VERDE' : 'Estado: ROJO');
console.log('════════════════════════════════════════');
process.exit(verde ? 0 : 1);