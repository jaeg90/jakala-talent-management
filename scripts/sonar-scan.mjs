/**
 * Puerta SonarQube del arnés de calidad (ver AGENTS.md).
 *
 * Convención de salida para scripts/quality.mjs:
 *   0 = PASS, 1 = FAIL, 2 = SKIP (servidor no disponible o sin token).
 *
 * Requisitos: un servidor SonarQube local (docker-compose.sonar.yml) y un token
 * en SONAR_TOKEN. El análisis no necesita Java: @sonar/scan descarga el JRE y el
 * motor del scanner por sí mismo.
 */
import { scan } from '@sonar/scan';

const serverUrl = (process.env.SONAR_HOST_URL ?? 'http://localhost:9000').replace(/\/+$/, '');
const token = process.env.SONAR_TOKEN;

function skip(motivo) {
  console.log(`SONARQUBE: SKIP — ${motivo}`);
  process.exit(2);
}

async function serverUp(url) {
  try {
    const res = await fetch(`${url}/api/system/status`, { signal: AbortSignal.timeout(3000) });
    return res.ok;
  } catch {
    return false;
  }
}

if (!token) {
  skip('falta SONAR_TOKEN (crea un token en http://localhost:9000)');
}

if (!(await serverUp(serverUrl))) {
  skip(`no hay SonarQube en ${serverUrl} (arranca "docker compose -f docker-compose.sonar.yml up -d")`);
}

await scan({ serverUrl, token });
console.log('SONARQUBE: PASS');