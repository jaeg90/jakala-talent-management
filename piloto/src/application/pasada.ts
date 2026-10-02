import { crearPasada, paso, resultado } from '../domain/maquina.js';
import type { Comando, Evento, Etiquetas, Pasada } from '../domain/model.js';
import { describirOrigen } from '../domain/model.js';
import type { Puertos } from '../domain/ports.js';

/**
 * El loop de la pasada: el único lugar donde el núcleo y el mundo se cruzan.
 * El núcleo decide y narra; aquí se ejecutan sus comandos contra los puertos
 * y sus respuestas vuelven al núcleo como eventos. Ninguna decisión vive aquí.
 */

/** Cómo se muestra la narración (consola en producción, colector en tests). */
export type Narrador = (linea: string) => void;

/** Lo que el loop necesita saber de la configuración. */
export interface ConfigPasada {
  reintentos: number;
  /** Etiquetas del tracker (ready-for-agent / ready-for-human / needs-grill). */
  etiquetas: Etiquetas;
}

/** Corre una pasada completa hasta que la máquina termine: verde al fondo o escalado. */
export async function correrPasada(
  puertos: Puertos,
  config: ConfigPasada,
  narrar: Narrador,
): Promise<Pasada> {
  const tickets = await puertos.frontera.cargarTickets();
  let pasada = crearPasada({ reintentos: config.reintentos, tickets });
  let volcadas = 0;
  const volcar = (): void => {
    for (; volcadas < pasada.narracion.length; volcadas++) {
      const linea = pasada.narracion[volcadas];
      if (linea !== undefined) narrar(linea);
    }
  };
  volcar();

  while (pasada.fase !== 'fin') {
    const movimiento = paso(pasada);
    pasada = movimiento.pasada;
    volcar();

    let pendientes = movimiento.comandos;
    while (pendientes.length > 0) {
      const siguientes: Comando[] = [];
      for (const comando of pendientes) {
        const evento = await ejecutarComando(puertos, config, comando);
        if (evento !== null) {
          const respuesta = resultado(pasada, evento);
          pasada = respuesta.pasada;
          volcar();
          siguientes.push(...respuesta.comandos);
        }
      }
      pendientes = siguientes;
    }
  }
  return pasada;
}

/** Ejecuta un comando contra los puertos; devuelve el evento que el mundo responde, si hay. */
async function ejecutarComando(
  puertos: Puertos,
  config: ConfigPasada,
  comando: Comando,
): Promise<Evento | null> {
  switch (comando.tipo) {
    case 'lanzarImplementadora': {
      const entrega = await puertos.sesiones.implementar(comando.ticket);
      return entrega.tipo === 'ticketDevuelto'
        ? { tipo: 'ticketDevuelto', dudas: entrega.dudas }
        : { tipo: 'diffListo', resumen: entrega.resumen };
    }
    case 'lanzarRevisora': {
      const veredicto = await puertos.sesiones.revisar(comando.ticket);
      if (veredicto.dudas.length > 0) {
        return {
          tipo: 'revisiónConDuda',
          hallazgos: veredicto.hallazgos,
          dudas: veredicto.dudas.join('\n'),
        };
      }
      return veredicto.hallazgos === null
        ? { tipo: 'revisiónSinHallazgos' }
        : { tipo: 'revisiónConHallazgo', texto: veredicto.hallazgos };
    }
    case 'abrirPuertas': {
      const rojo = await puertos.puertas.ejecutar();
      return rojo === null
        ? { tipo: 'puertasEnVerde' }
        : { tipo: 'puertaEnRojo', puerta: rojo.puerta, salida: rojo.salida };
    }
    case 'lanzarReparadora':
      await puertos.sesiones.reparar(comando.ticket, comando.error, comando.reintento);
      return { tipo: 'parcheListo' };
    case 'empujarYCerrar':
      await puertos.entrega.empujar(comando.ticket);
      await puertos.frontera.cerrar(comando.ticket.numero, comando.resumen ?? 'Implementado por el Piloto.');
      return null;
    case 'escalar': {
      const comentario =
        'Escalado por el Piloto: reintentos agotados. ' +
        `Último error (${describirOrigen(comando.error)}): «${comando.error.texto}».`;
      await puertos.frontera.etiquetar(
        comando.ticket.numero,
        config.etiquetas.escalado,
        config.etiquetas.lista,
      );
      await puertos.frontera.comentar(comando.ticket.numero, comentario);
      await puertos.avisos.avisar(
        `El Piloto escaló el ticket #${comando.ticket.numero} a un humano. La pasada se detiene. ${comentario}`,
      );
      return null;
    }
    case 'devolver': {
      const lineas = [
        'Devuelto por el Piloto: el cuerpo del ticket no determina la implementación (ADR-0012).',
        'Dudas que una sesión de grill con el humano debe resolver:',
        ...comando.dudas.split('\n').map((d) => `- ${d}`),
      ];
      if (comando.hallazgos !== null) {
        lineas.push(
          '',
          'Hallazgos ya detectados en el diff (contexto para el grill, no dudas):',
          ...comando.hallazgos.split('\n').map((h) => `- ${h}`),
        );
      }
      lineas.push(
        '',
        'Desenlace esperado: las respuestas del grill aterrizan en este cuerpo (antídotos, ADR-0011),',
        'se retira «needs-grill» y se repone «ready-for-agent»; la siguiente pasada retoma el diff donde quedó.',
      );
      const comentario = lineas.join('\n');
      await puertos.frontera.etiquetar(
        comando.ticket.numero,
        config.etiquetas.devolución,
        config.etiquetas.lista,
      );
      await puertos.frontera.comentar(comando.ticket.numero, comentario);
      await puertos.avisos.avisar(
        `El Piloto devolvió el ticket #${comando.ticket.numero}: el cuerpo no determina la implementación. ` +
          `La pasada se detiene. ${comentario}`,
      );
      return null;
    }
    case 'terminar':
      // La narración del núcleo ya lo cuenta; no hay efecto que ejecutar.
      return null;
  }
}
