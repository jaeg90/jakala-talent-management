import type { Ticket } from '../domain/model.js';
import type { PuertoFrontera } from '../domain/ports.js';
import { ejecutar } from './procesos.js';

/**
 * Adaptador de frontera: GitHub Issues vía gh CLI.
 * Un issue abierto con la etiqueta de lista es candidato; cerrado, cuenta como
 * bloqueo resuelto; con la etiqueta de escalado, queda fuera del Piloto.
 */

interface IssueGh {
  number: number;
  title: string;
  body: string | null;
  state: 'OPEN' | 'CLOSED';
  labels: { name: string }[];
}

/** Los bloqueos que declara el cuerpo del issue: la sección «## Bloqueado por». */
function bloqueadosDe(cuerpo: string | null): number[] {
  const seccion = (cuerpo ?? '').split(/^## /m).find((s) => s.startsWith('Bloqueado por')) ?? '';
  return [...seccion.matchAll(/#(\d+)/g)].map((m) => Number(m[1]));
}

function ticketsDesdeIssues(issues: IssueGh[], etiquetas: { lista: string; escalado: string }): Ticket[] {
  const abiertos = issues.filter((i) => i.state === 'OPEN');
  const referenciadosComoBloqueo = new Set(abiertos.flatMap((i) => bloqueadosDe(i.body)));

  const tickets: Ticket[] = [];
  for (const issue of issues) {
    const tiene = (etiqueta: string): boolean => issue.labels.some((l) => l.name === etiqueta);
    if (issue.state === 'OPEN') {
      // Abierto sin etiqueta de lista: invisible para el Piloto (pero sigue bloqueando).
      if (tiene(etiquetas.escalado)) {
        tickets.push(aTicket(issue, 'escalado'));
      } else if (tiene(etiquetas.lista)) {
        tickets.push(aTicket(issue, 'lista'));
      }
    } else if (referenciadosComoBloqueo.has(issue.number)) {
      // Cerrado: solo interesa si alguien abierto lo declara como bloqueo.
      tickets.push(aTicket(issue, 'cerrado'));
    }
  }
  return tickets;
}

function aTicket(issue: IssueGh, estado: Ticket['estado']): Ticket {
  return {
    numero: issue.number,
    titulo: issue.title,
    cuerpo: issue.body ?? '',
    estado,
    bloqueadoPor: bloqueadosDe(issue.body),
  };
}

export function crearFrontera(etiquetas: { lista: string; escalado: string }): PuertoFrontera {
  return {
    async cargarTickets(): Promise<Ticket[]> {
      const salida = await ejecutar('gh', [
        'issue',
        'list',
        '--state',
        'all',
        '--limit',
        '300',
        '--json',
        'number,title,body,state,labels',
      ]);
      const issues = JSON.parse(salida) as IssueGh[];
      return ticketsDesdeIssues(issues, etiquetas);
    },
    async etiquetar(ticket, poner, quitar): Promise<void> {
      const args = ['issue', 'edit', String(ticket), '--add-label', poner];
      if (quitar !== undefined) args.push('--remove-label', quitar);
      await ejecutar('gh', args);
    },
    async comentar(ticket, comentario): Promise<void> {
      await ejecutar('gh', ['issue', 'comment', String(ticket), '--body-file', '-'], {
        entrada: comentario,
      });
    },
    async cerrar(ticket, resumen): Promise<void> {
      await ejecutar('gh', ['issue', 'close', String(ticket), '--comment', resumen]);
    },
  };
}
