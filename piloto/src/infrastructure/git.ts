import type { Ticket } from '../domain/model.js';
import type { PuertoEntrega } from '../domain/ports.js';
import { ejecutar } from './procesos.js';

/**
 * Adaptador de entrega: empuja el cambio validado por las puertas.
 * - modo main: commit de lo pendiente (si la sesión ya commiteó, no duplica) y push.
 * - modo rama: rama propia, PR, squash-merge inmediato (las puertas ya juzgaron)
 *   y vuelta a main actualizada, para que el siguiente ticket empiece limpio.
 */

/** Mensaje al convenio del repo: «feat: ficha de mentee y 1-to-1s… (#4)». */
function mensajeDeCommit(ticket: Ticket): string {
  const sinPrefijo = ticket.titulo.replace(/^Ticket \d+:\s*/, '');
  const primera = sinPrefijo.charAt(0).toLowerCase();
  return `feat: ${primera}${sinPrefijo.slice(1)} (#${ticket.numero})`;
}

export function crearEntrega(modo: 'main' | 'rama', raiz: string): PuertoEntrega {
  return {
    async empujar(ticket: Ticket): Promise<void> {
      const mensaje = mensajeDeCommit(ticket);
      if (modo === 'main') {
        await ejecutar('git', ['add', '-A'], { cwd: raiz });
        // diff --cached --quiet termina en 1 si HAY cambios: entonces sí hay que commitear.
        await ejecutar('git', ['diff', '--cached', '--quiet'], { cwd: raiz }).catch(async () => {
          await ejecutar('git', ['commit', '-m', mensaje], { cwd: raiz });
        });
        await ejecutar('git', ['push'], { cwd: raiz });
        return;
      }
      const rama = `piloto/${ticket.numero}`;
      await ejecutar('git', ['checkout', '-b', rama], { cwd: raiz });
      await ejecutar('git', ['add', '-A'], { cwd: raiz });
      await ejecutar('git', ['commit', '-m', mensaje], { cwd: raiz }).catch(async () => {
        // Nada pendiente (la sesión ya commiteó): seguir con lo que haya.
        await ejecutar('git', ['diff', '--cached', '--quiet'], { cwd: raiz });
      });
      await ejecutar('git', ['push', '-u', 'origin', rama], { cwd: raiz });
      await ejecutar(
        'gh',
        [
          'pr',
          'create',
          '--title',
          mensaje,
          '--body',
          `Cierra #${ticket.numero}. Implementado por el Piloto; todas las puertas del arnés en verde.`,
        ],
        { cwd: raiz },
      );
      await ejecutar('gh', ['pr', 'merge', rama, '--squash', '--delete-branch', '--subject', mensaje], {
        cwd: raiz,
      });
      await ejecutar('git', ['checkout', 'main'], { cwd: raiz });
      await ejecutar('git', ['pull'], { cwd: raiz });
    },
  };
}
