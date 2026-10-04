/**
 * Puerta de lint de literales en `web/src/lino.css` (regla del arnés, decidida
 * el 4-oct tras el paquete Lino): la categoría «valores fuera de tokens.css»
 * fue el hallazgo más repetido de la revisora (#17, #18 y #20 la quemaron).
 *
 * Regla determinista: todo literal de `px`, color hex u `oklch(…)` que aparezca
 * en código (fuera de comentarios) debe estar cubierto por una CITA — un `§` de
 * doc de diseño (spec/componentes/accesibilidad) o un `#N` de ticket — en el
 * comentario de su propia línea o en los comentarios acumulados desde el último
 * cierre de regla (`}`). Un literal citado es una decisión de spec documentada;
 * un literal sin cita es un valor mágico y rompe la puerta.
 *
 * Cableado: `npm run lint` (puerta del Piloto y autochequeo de las sesiones,
 * ADR-0010). Salida: 0 = limpio, 1 = hay literales sin cita.
 */
import { readFileSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = dirname(dirname(fileURLToPath(import.meta.url)));
const archivo = process.argv[2] ?? join(root, 'web', 'src', 'lino.css');

/** Marca de cita: `§` (doc de diseño) o `#N` (ticket) — un hex como `#3730a3` no es cita. */
const CITA = /§|#[0-9]+(?![0-9a-fA-F])/;
/** Literales vetados si quedan sin cita: longitudes px, colores hex y oklch(). */
const LITERAL = /[0-9]+(?:\.[0-9]+)?px\b|#[0-9a-fA-F]{3,8}\b|oklch\(/g;

/**
 * Parte una línea en código y comentario según el estado de comentario heredado
 * de la línea anterior (`/* … *​/` puede abarcar varias líneas o cerrar a mitad
 * de línea). Devuelve el texto de cada parte y el estado de comentario final.
 */
function partirLinea(linea, enComentario) {
  let codigo = '';
  let comentario = '';
  let i = 0;
  while (i < linea.length) {
    if (enComentario) {
      const cierre = linea.indexOf('*/', i);
      if (cierre === -1) {
        comentario += linea.slice(i);
        i = linea.length;
      } else {
        comentario += linea.slice(i, cierre);
        i = cierre + 2;
        enComentario = false;
      }
    } else {
      const apertura = linea.indexOf('/*', i);
      const fin = apertura === -1 ? linea.length : apertura;
      codigo += linea.slice(i, fin);
      if (apertura === -1) {
        i = linea.length;
      } else {
        i = apertura + 2;
        enComentario = true;
      }
    }
  }
  return { codigo, comentario, enComentario };
}

let lineas;
try {
  lineas = readFileSync(archivo, 'utf8').split(/\r?\n/);
} catch {
  console.error(`lino-literal: no puedo leer ${archivo}`);
  process.exit(2);
}

let enComentario = false;
let profundidad = 0; // Llaves abiertas: 0 = fuera de toda regla y bloque.
let contextoCitas = ''; // Comentarios acumulados desde el último retorno a profundidad 0.
const violaciones = [];

lineas.forEach((linea, idx) => {
  const { codigo, comentario, enComentario: quedaEnComentario } = partirLinea(
    linea,
    enComentario,
  );
  enComentario = quedaEnComentario;
  contextoCitas += `${comentario}\n`;

  const literales = [...codigo.matchAll(LITERAL)].map((m) => m[0]);
  if (literales.length > 0 && !CITA.test(comentario) && !CITA.test(contextoCitas)) {
    violaciones.push({ numero: idx + 1, linea: linea.trim(), literales });
  }

  // Solo se agota la cobertura al VOLVER a profundidad 0 cerrando llave (fin de
  // la regla o del bloque): los comentarios escritos a profundidad 0 — la
  // cita que adjunta la regla que viene después — sobreviven hasta esa regla.
  const abre = (codigo.match(/{/g) ?? []).length;
  const cierra = (codigo.match(/}/g) ?? []).length;
  profundidad = Math.max(0, profundidad + abre - cierra);
  if (profundidad === 0 && cierra > 0) contextoCitas = '';
});

if (violaciones.length === 0) {
  console.log('lino-literal: sin literales sin cita en lino.css');
  process.exit(0);
}

console.error(
  `lino-literal: ${violaciones.length} línea(s) con literales (px/hex/oklch) sin cita § o #N en lino.css:`,
);
for (const v of violaciones) {
  console.error(`  línea ${v.numero}: ${v.literales.join(', ')} — ${v.linea}`);
}
process.exit(1);