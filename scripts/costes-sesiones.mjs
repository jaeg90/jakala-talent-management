#!/usr/bin/env node
// Costes medidos de las sesiones de IA (T6 del TFM): lee la base local de
// sesiones de OpenCode (SQLite, solo lectura) y genera, sobrescribiendo:
//   docs/costes/sesiones-piloto.csv — una fila por sesión del Piloto
//   docs/costes/resumen.md         — totales, desgloses y caché
// Uso: node scripts/costes-sesiones.mjs [ruta-db]  (por defecto .tmp/opencode.db)
//
// Conteo: «mensajes» son los turnos de conversación (user + assistant); los
// tipos idle/synthetic/system/agent-switched son marcadores sin coste. El
// coste y los tokens viven en los mensajes de assistant (data.cost,
// data.tokens). De las sesiones interactivas solo salen agregados, nunca
// títulos (pueden contener texto personal).
//
// Conciliación con OpenRouter: docs/costes/README.md.

import Database from 'better-sqlite3';
import { mkdirSync, writeFileSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const RAIZ = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const RUTA_DB = process.argv[2] ?? resolve(RAIZ, '.tmp', 'opencode.db');
const CARPETA = resolve(RAIZ, 'docs', 'costes');

/** Título real de las sesiones del Piloto: «Piloto · papel · #ticket»
 *  (las tres reparadoras de la primera pasada, 27-sep, van sin «#ticket»). */
const RE_PILOTO = /^Piloto · (implementadora|revisora|reparadora)(?: · #(\d+))?/;

/** Formato con separador de miles y punto decimal. */
const numero = (n) =>
  Math.round(n).toLocaleString('en-US', { maximumFractionDigits: 0 });
const usd = (n) => n.toLocaleString('en-US', { minimumFractionDigits: 2, maximumFractionDigits: 2 });
const porcentaje = (n) => `${n.toLocaleString('en-US', { maximumFractionDigits: 1 })} %`;

function leerSesiones(db) {
  const sesiones = db.prepare('SELECT id, title, time_created FROM session_v2').all();
  const porSesion = new Map();
  let total = null;
  let piloto = null;
  let interactiva = null;
  const vacia = () => ({
    sesiones: 0, mensajes: 0, entrada: 0, salida: 0, razonamiento: 0,
    cacheLectura: 0, cacheEscritura: 0, coste: 0,
  });
  for (const s of sesiones) {
    const encontrados = RE_PILOTO.exec(s.title ?? '');
    const papel = encontrados?.[1] ?? null;
    const ticket = encontrados?.[2] ? Number(encontrados[2]) : null;
    const mensajes = db
      .prepare('SELECT type, time_created, data FROM session_message WHERE session_id = ? ORDER BY seq')
      .all(s.id);
    const agregado = { ...vacia(), fecha: null, modelos: new Set() };
    for (const m of mensajes) {
      if (agregado.fecha === null) agregado.fecha = m.time_created;
      if (m.type !== 'user' && m.type !== 'assistant') continue;
      agregado.mensajes++;
      if (m.type !== 'assistant') continue;
      const d = JSON.parse(m.data);
      if (d.model?.id) agregado.modelos.add(d.model.id);
      if (d.cost == null) continue;
      agregado.coste += d.cost ?? 0;
      agregado.entrada += d.tokens?.input ?? 0;
      agregado.salida += d.tokens?.output ?? 0;
      agregado.razonamiento += d.tokens?.reasoning ?? 0;
      agregado.cacheLectura += d.tokens?.cache?.read ?? 0;
      agregado.cacheEscritura += d.tokens?.cache?.write ?? 0;
    }
    agregado.fecha = new Date(mensajes[0]?.time_created ?? s.time_created).toISOString().slice(0, 10);
    const fila = { ...agregado, modelos: [...agregado.modelos], papel, ticket, titulo: s.title ?? '' };
    porSesion.set(s.id, fila);

    total ??= vacia(); piloto ??= vacia(); interactiva ??= vacia();
    const destinos = papel ? [total, piloto] : [total, interactiva];
    for (const d of destinos) {
      d.sesiones++; d.mensajes += fila.mensajes; d.coste += fila.coste;
      d.entrada += fila.entrada; d.salida += fila.salida; d.razonamiento += fila.razonamiento;
      d.cacheLectura += fila.cacheLectura; d.cacheEscritura += fila.cacheEscritura;
    }
  }
  return { porSesion: [...porSesion.values()], total, piloto, interactiva };
}

const tokensTotales = (s) =>
  s.entrada + s.salida + s.razonamiento + s.cacheLectura + s.cacheEscritura;

function csvPiloto(sesiones) {
  const filas = sesiones
    .filter((s) => s.papel)
    .sort((a, b) =>
      a.fecha !== b.fecha ? a.fecha.localeCompare(b.fecha)
      : (a.ticket ?? -1) - (b.ticket ?? -1) || (a.papel ?? '').localeCompare(b.papel ?? ''));
  const cabecera =
    'fecha,ticket,papel,modelo,mensajes,tokens_entrada,tokens_salida,tokens_razonamiento,tokens_cache_lectura,tokens_cache_escritura,coste_usd';
  const lineas = filas.map((s) =>
    [
      s.fecha, s.ticket, s.papel, s.modelos.join('+'), s.mensajes,
      s.entrada, s.salida, s.razonamiento, s.cacheLectura, s.cacheEscritura,
      s.coste.toFixed(4),
    ].join(','),
  );
  return `${cabecera}\n${lineas.join('\n')}\n`;
}

function resumen(sesiones, total, piloto, interactiva) {
  const hoy = new Date().toISOString().slice(0, 10);
  const L = [];
  L.push(
    `Generado el ${hoy} por scripts/costes-sesiones.mjs a partir de la base de sesiones local de OpenCode. ` +
      'Los costes son los que OpenCode registra por mensaje y pueden diferir de la factura de OpenRouter.',
  );

  const filaTotales = (nombre, s) =>
    `| ${nombre} | ${numero(s.sesiones)} | ${numero(s.mensajes)} | ${numero(s.entrada)} | ${numero(s.salida)} | ` +
    `${numero(s.razonamiento)} | ${numero(s.cacheLectura)} | ${numero(s.cacheEscritura)} | ${usd(s.coste)} |`;
  L.push('', '## Totales', '',
    '| | Sesiones | Mensajes | Tokens entrada | Tokens salida | Tokens razonamiento | Tokens caché lectura | Tokens caché escritura | Coste (USD) |',
    '|---|---|---|---|---|---|---|---|---|',
    filaTotales('Todas las sesiones', total),
    filaTotales('Piloto', piloto),
    filaTotales('Interactivas', interactiva));

  const papeles = ['implementadora', 'reparadora', 'revisora'];
  L.push('', '## Piloto por papel', '',
    '| Papel | Sesiones | Tokens totales | Coste (USD) |', '|---|---|---|---|');
  for (const papel of papeles) {
    const delPapel = sesiones.filter((s) => s.papel === papel);
    const t = delPapel.reduce(
      (acc, s) => ({ sesiones: acc.sesiones + 1, tokens: acc.tokens + tokensTotales(s), coste: acc.coste + s.coste }),
      { sesiones: 0, tokens: 0, coste: 0 },
    );
    L.push(`| ${papel} | ${numero(t.sesiones)} | ${numero(t.tokens)} | ${usd(t.coste)} |`);
  }

  const porModelo = new Map();
  for (const s of sesiones) {
    for (const m of s.modelos) {
      const x = porModelo.get(m) ?? { sesiones: 0, mensajes: 0, tokens: 0, coste: 0 };
      x.sesiones++; x.mensajes += s.mensajes; x.tokens += tokensTotales(s); x.coste += s.coste;
      porModelo.set(m, x);
    }
  }
  L.push('', '## Por modelo (todas las sesiones)', '',
    '| Modelo | Sesiones | Mensajes | Tokens totales | Coste (USD) |', '|---|---|---|---|---|');
  for (const [modelo, x] of [...porModelo].sort((a, b) => b[1].coste - a[1].coste)) {
    L.push(`| ${modelo} | ${numero(x.sesiones)} | ${numero(x.mensajes)} | ${numero(x.tokens)} | ${usd(x.coste)} |`);
  }

  const porTicket = new Map();
  for (const s of sesiones) {
    if (!s.papel) continue;
    const x = porTicket.get(s.ticket) ?? { sesiones: 0, reparadoras: 0, tokens: 0, coste: 0 };
    x.sesiones++; if (s.papel === 'reparadora') x.reparadoras++;
    x.tokens += tokensTotales(s); x.coste += s.coste;
    porTicket.set(s.ticket, x);
  }
  const tickets = [...porTicket].sort((a, b) => a[0] - b[0]);
  L.push('', '## Por ticket (solo Piloto)', '',
    '| Ticket | Sesiones | Reparadoras | Tokens totales | Coste (USD) |', '|---|---|---|---|---|');
  for (const [ticket, x] of tickets) {
    L.push(`| #${ticket} | ${numero(x.sesiones)} | ${numero(x.reparadoras)} | ${numero(x.tokens)} | ${usd(x.coste)} |`);
  }
  L.push('', '### Los 5 tickets más caros', '',
    '| Ticket | Sesiones | Coste (USD) |', '|---|---|---|');
  for (const [ticket, x] of [...porTicket].sort((a, b) => b[1].coste - a[1].coste).slice(0, 5)) {
    L.push(`| #${ticket} | ${numero(x.sesiones)} | ${usd(x.coste)} |`);
  }

  const porDia = new Map();
  for (const s of sesiones) {
    const x = porDia.get(s.fecha) ?? { sesiones: 0, mensajes: 0, tokens: 0, coste: 0 };
    x.sesiones++; x.mensajes += s.mensajes; x.tokens += tokensTotales(s); x.coste += s.coste;
    porDia.set(s.fecha, x);
  }
  L.push('', '## Coste por día (todas las sesiones)', '',
    '| Día | Sesiones | Mensajes | Tokens totales | Coste (USD) |', '|---|---|---|---|---|');
  for (const [dia, x] of [...porDia].sort()) {
    L.push(`| ${dia} | ${numero(x.sesiones)} | ${numero(x.mensajes)} | ${numero(x.tokens)} | ${usd(x.coste)} |`);
  }

  const pctCache = (s) => (s.entrada + s.cacheLectura) > 0 ? (100 * s.cacheLectura) / (s.entrada + s.cacheLectura) : 0;
  L.push('', '## Porcentaje de caché', '',
    'Tokens de caché leída sobre (entrada + caché leída). El ADR-0013 afirma que una sesión del Piloto es ~98 % lectura de caché; este dato lo confirma o lo corrige.', '',
    '| | Tokens entrada | Tokens caché lectura | % caché lectura |', '|---|---|---|---|',
    `| Todas las sesiones | ${numero(total.entrada)} | ${numero(total.cacheLectura)} | ${porcentaje(pctCache(total))} |`,
    `| Piloto | ${numero(piloto.entrada)} | ${numero(piloto.cacheLectura)} | ${porcentaje(pctCache(piloto))} |`);

  // Papel de cada modelo, deducido de qué sesiones lo usaron (no de los nombres).
  const papelPorModelo = new Map();
  for (const s of sesiones) {
    for (const m of s.modelos) {
      const x = papelPorModelo.get(m) ?? {};
      const clase = s.papel ?? 'interactiva';
      x[clase] = (x[clase] ?? 0) + 1;
      papelPorModelo.set(m, x);
    }
  }
  const NOMBRE_CLASE = { implementadora: 'implementadora', reparadora: 'reparadora', revisora: 'revisora', interactiva: 'sesiones interactivas' };
  L.push('', '## Papel de cada modelo (deducido de la base)', '',
    'Qué papeles del Piloto y qué sesiones interactivas usaron cada modelo, según los títulos de las sesiones que lo emplearon.', '',
    '| Modelo | Papel en el proyecto | Sesiones |', '|---|---|---|');
  for (const [modelo, clases] of [...papelPorModelo].sort(
    (a, b) => Object.values(b[1]).reduce((x, y) => x + y, 0) - Object.values(a[1]).reduce((x, y) => x + y, 0),
  )) {
    const totalSesiones = Object.values(clases).reduce((a, b) => a + b, 0);
    const papeles = Object.entries(clases)
      .sort((a, b) => (a[0] === 'interactiva' ? 1 : 0) - (b[0] === 'interactiva' ? 1 : 0))
      .map(([c, n]) => `${NOMBRE_CLASE[c]} (${n})`);
    L.push(`| ${modelo} | ${papeles.join(', ')} | ${numero(totalSesiones)} |`);
  }
  return L.join('\n') + '\n';
}

const db = new Database(RUTA_DB, { readonly: true });
const { porSesion, total, piloto, interactiva } = leerSesiones(db);
db.close();

mkdirSync(CARPETA, { recursive: true });
writeFileSync(resolve(CARPETA, 'sesiones-piloto.csv'), csvPiloto(porSesion), 'utf8');
writeFileSync(resolve(CARPETA, 'resumen.md'), resumen(porSesion, total, piloto, interactiva), 'utf8');
console.log(
  `Generados docs/costes/sesiones-piloto.csv (${porSesion.filter((s) => s.papel).length} sesiones del Piloto) y docs/costes/resumen.md (${total.sesiones} sesiones, ${usd(total.coste)} USD) desde ${RUTA_DB}.`,
);