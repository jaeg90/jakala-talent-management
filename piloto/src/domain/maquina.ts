import type { Evento, Movimiento, Pasada, Ticket } from './model.js';

/**
 * Núcleo del Piloto (ADR-0003): máquina de estados pura, la misma que validó el
 * prototipo (rama prototipo/piloto-loop-estados). Sin I/O: decide, narra y ordena
 * comandos; los efectos los ejecuta la aplicación contra los puertos (ADR-0004).
 * La devolución por dudas de spec (ADR-0012) es la única salida del ciclo que no
 * nace de un rojo: no consume reintentos porque el defecto es del cuerpo, no del diff.
 */

const con = (pasada: Pasada, cambios: Partial<Pasada>, linea: string): Pasada => ({
  ...pasada,
  ...cambios,
  narracion: [...pasada.narracion, linea],
});

const numeros = (ns: number[]): string => ns.map((n) => `#${n}`).join(', ');

/** La frontera: tickets listos cuyos bloqueos están todos cerrados, ordenados por número. */
export function fronteraDe(pasada: Pasada): Ticket[] {
  return pasada.tickets
    .filter((t) => t.estado === 'lista')
    .filter((t) => t.bloqueadoPor.every((n) => pasada.tickets.find((x) => x.numero === n)?.estado === 'cerrado'))
    .sort((a, b) => a.numero - b.numero);
}

/** Crea una pasada con la frontera inicial cargada. */
export function crearPasada(entradas: { reintentos: number; tickets: Ticket[] }): Pasada {
  return {
    fase: 'frontera',
    reintentosConfigurados: entradas.reintentos,
    tickets: entradas.tickets,
    ticketActual: null,
    reintentosUsados: 0,
    error: null,
    resumen: null,
    narracion: [
      'El Piloto arranca. Consulto la frontera: tickets desbloqueados y ready-for-agent.',
    ],
  };
}

/**
 * El único movimiento autónomo del coordinador (ADR-0003): un paso determinista.
 * En las fases de espera no decide nada: espera el resultado que el mundo traiga.
 */
export function paso(pasada: Pasada): Movimiento {
  switch (pasada.fase) {
    case 'frontera': {
      const elegido = fronteraDe(pasada).at(0);
      if (elegido === undefined) {
        const abiertos = pasada.tickets.filter((t) => t.estado !== 'cerrado').map((t) => t.numero);
        const nueva = con(
          pasada,
          { fase: 'fin' },
          'Frontera vacía: nada desbloqueado y ready-for-agent. Termino la pasada.' +
            (abiertos.length > 0 ? ` Quedan abiertos: ${numeros(abiertos)}.` : ''),
        );
        return { pasada: nueva, comandos: [{ tipo: 'terminar', motivo: 'fronteraVacia', abiertos }] };
      }
      const nueva = con(
        pasada,
        { fase: 'implementación', ticketActual: elegido.numero, reintentosUsados: 0, error: null, resumen: null },
        `Frontera: ${numeros(fronteraDe(pasada).map((t) => t.numero))}. Elijo #${elegido.numero} (el de menor número). ` +
          'Lanzo la implementadora: sesión nueva, no interactiva, recibe solo el ticket.',
      );
      return { pasada: nueva, comandos: [{ tipo: 'lanzarImplementadora', ticket: elegido }] };
    }
    case 'implementación':
      return { pasada: con(pasada, {}, 'Nada que decidir: espero el diff de la implementadora.'), comandos: [] };
    case 'revisión':
      return { pasada: con(pasada, {}, 'Nada que decidir: espero el resultado de la revisora.'), comandos: [] };
    case 'puertas':
      return { pasada: con(pasada, {}, 'Las puertas corren: espero su veredicto.'), comandos: [] };
    case 'reparación':
      return { pasada: con(pasada, {}, 'Nada que decidir: espero el parche de la reparadora.'), comandos: [] };
    case 'verde': {
      const t = ticketDe(pasada, pasada.ticketActual);
      const tickets = pasada.tickets.map((x) => (x.numero === t.numero ? { ...x, estado: 'cerrado' as const } : x));
      const nueva = con(
        pasada,
        { fase: 'frontera' as const, tickets, ticketActual: null, error: null },
        `Verde: empujo el cambio y cierro #${t.numero} con un comentario resumen. Vuelvo a la frontera.`,
      );
      return { pasada: nueva, comandos: [{ tipo: 'empujarYCerrar', ticket: t, resumen: pasada.resumen }] };
    }
    case 'rojo': {
      const error = pasada.error;
      if (error === null) throw new Error('Rojo sin error en mano');
      if (pasada.reintentosUsados >= pasada.reintentosConfigurados) {
        const t = ticketDe(pasada, pasada.ticketActual);
        const tickets = pasada.tickets.map((x) => (x.numero === t.numero ? { ...x, estado: 'escalado' as const } : x));
        const nueva = con(
          pasada,
          { fase: 'escalado' as const, tickets },
          `Reintentos agotados (${pasada.reintentosUsados} de ${pasada.reintentosConfigurados}). ` +
            `Etiqueto #${t.numero} como ready-for-human, comento el último error («${error.texto}») y aviso al humano. ` +
            'Me detengo: no paso al siguiente ticket.',
        );
        return { pasada: nueva, comandos: [{ tipo: 'escalar', ticket: t, error }] };
      }
      const usados = pasada.reintentosUsados + 1;
      const nueva = con(
        pasada,
        { fase: 'reparación' as const, reintentosUsados: usados },
        `Rojo con ${pasada.reintentosUsados} de ${pasada.reintentosConfigurados} reintentos usados. ` +
          `Lanzo una reparadora nueva (reintento ${usados} de ${pasada.reintentosConfigurados}): contexto fresco, recibe el ticket y el error en mano.`,
      );
      return {
        pasada: nueva,
        comandos: [
          {
            tipo: 'lanzarReparadora',
            ticket: ticketDe(pasada, pasada.ticketActual),
            reintento: usados,
            reintentosConfigurados: pasada.reintentosConfigurados,
            error,
          },
        ],
      };
    }
    case 'escalado': {
      const abiertos = pasada.tickets.filter((t) => t.estado !== 'cerrado').map((t) => t.numero);
      const nueva = con(
        pasada,
        { fase: 'fin' as const },
        `Cierro la pasada: #${pasada.ticketActual} queda en manos del humano y no paso al siguiente ticket. ` +
          'Cuando esté resuelto, se arranca otra pasada.',
      );
      return { pasada: nueva, comandos: [{ tipo: 'terminar', motivo: 'escalado', abiertos }] };
    }
    case 'devuelta': {
      const abiertos = pasada.tickets.filter((t) => t.estado !== 'cerrado').map((t) => t.numero);
      const nueva = con(
        pasada,
        { fase: 'fin' as const },
        `Cierro la pasada: #${pasada.ticketActual} vuelve al humano para una sesión de grill ` +
          '(necesita decisiones de spec, no parches) y no paso al siguiente ticket. ' +
          'Cuando el cuerpo esté endurecido, otra pasada retoma el diff donde quedó.',
      );
      return { pasada: nueva, comandos: [{ tipo: 'terminar', motivo: 'devolución', abiertos }] };
    }
    case 'fin':
      return { pasada: con(pasada, {}, 'La pasada terminó.'), comandos: [] };
  }
}

const ticketDe = (pasada: Pasada, numero: number | null): Ticket => {
  const t = pasada.tickets.find((x) => x.numero === numero);
  if (t === undefined) throw new Error(`Ticket #${numero} no está en la pasada`);
  return t;
};

const ignorado = (pasada: Pasada, qué: string): Movimiento => ({
  pasada: con(pasada, {}, `Resultado inesperado (${qué}): en fase «${pasada.fase}» no lo espero. Lo ignoro.`),
  comandos: [],
});

/**
 * Los resultados que el mundo trae (ADR-0003): las sesiones y las puertas hablan,
 * el Piloto escucha. Fuera de fase, el evento se ignora y se narra; nada refuta un veredicto.
 */
export function resultado(pasada: Pasada, evento: Evento): Movimiento {
  switch (evento.tipo) {
    case 'diffListo':
      if (pasada.fase !== 'implementación') return ignorado(pasada, 'diff de la implementadora');
      return {
        pasada: con(
          pasada,
          { fase: 'revisión', resumen: evento.resumen },
          `Diff listo (${evento.resumen}). Lanzo la revisora: sesión nueva, ve el diff sin heredar nada de la implementadora.`,
        ),
        comandos: [{ tipo: 'lanzarRevisora', ticket: ticketDe(pasada, pasada.ticketActual) }],
      };
    case 'revisiónSinHallazgos':
      if (pasada.fase !== 'revisión') return ignorado(pasada, 'revisión sin hallazgos');
      return {
        pasada: con(pasada, { fase: 'puertas' }, 'Revisora sin hallazgos. Abro las puertas del arnés.'),
        comandos: [{ tipo: 'abrirPuertas' }],
      };
    case 'revisiónConHallazgo':
      if (pasada.fase !== 'revisión') return ignorado(pasada, 'hallazgo de la revisora');
      return {
        pasada: con(
          pasada,
          { fase: 'rojo', error: { origen: 'revisión', texto: evento.texto } },
          `Hallazgo de la revisora: «${evento.texto}». La revisión nunca declara verde: solo puede forzar rojo.`,
        ),
        comandos: [],
      };
    case 'ticketDevuelto': {
      if (pasada.fase !== 'implementación') return ignorado(pasada, 'devolución de la implementadora');
      const t = ticketDe(pasada, pasada.ticketActual);
      const tickets = pasada.tickets.map((x) =>
        x.numero === t.numero ? { ...x, estado: 'devuelto' as const } : x,
      );
      const nueva = con(
        pasada,
        { fase: 'devuelta' as const, tickets },
        `La implementadora devuelve #${t.numero} sin construir: el cuerpo no determina la implementación ` +
          `(dudas: «${evento.dudas}»). No consume reintentos: el rojo es del cuerpo, no del ticket.`,
      );
      return {
        pasada: nueva,
        comandos: [{ tipo: 'devolver', ticket: t, dudas: evento.dudas, hallazgos: null }],
      };
    }
    case 'revisiónConDuda': {
      if (pasada.fase !== 'revisión') return ignorado(pasada, 'dudas de la revisora');
      const t = ticketDe(pasada, pasada.ticketActual);
      const tickets = pasada.tickets.map((x) =>
        x.numero === t.numero ? { ...x, estado: 'devuelto' as const } : x,
      );
      const nueva = con(
        pasada,
        { fase: 'devuelta' as const, tickets },
        `Dudas de spec de la revisora: «${evento.dudas}». ` +
          'Reparar una ambigüedad es volver a adivinar: devuelvo el ticket sin quemar reintento' +
          (evento.hallazgos !== null ? ' (los hallazgos viajan como contexto para el grill).' : '.'),
      );
      return {
        pasada: nueva,
        comandos: [{ tipo: 'devolver', ticket: t, dudas: evento.dudas, hallazgos: evento.hallazgos }],
      };
    }
    case 'puertasEnVerde':
      if (pasada.fase !== 'puertas') return ignorado(pasada, 'puertas en verde');
      return {
        pasada: con(pasada, { fase: 'verde' }, 'Todas las puertas en verde: su veredicto nadie lo refuta.'),
        comandos: [],
      };
    case 'puertaEnRojo':
      if (pasada.fase !== 'puertas') return ignorado(pasada, 'puerta en rojo');
      return {
        pasada: con(
          pasada,
          { fase: 'rojo', error: { origen: 'puerta', puerta: evento.puerta, texto: evento.salida } },
          `La puerta ${evento.puerta} en rojo. Su veredicto no se discute: rojo, con su salida como error.`,
        ),
        comandos: [],
      };
    case 'parcheListo':
      if (pasada.fase !== 'reparación') return ignorado(pasada, 'parche de la reparadora');
      return {
        pasada: con(
          pasada,
          { fase: 'revisión' },
          `Parche listo (reintento ${pasada.reintentosUsados} de ${pasada.reintentosConfigurados}). ` +
            'El parche vuelve a la revisión: nadie se autoevalúa.',
        ),
        comandos: [{ tipo: 'lanzarRevisora', ticket: ticketDe(pasada, pasada.ticketActual) }],
      };
  }
}
