import type { Manager } from '../domain/model.js';
import type { CuentaRepository, SessionStore } from '../domain/ports.js';
import { validarNuevaContrasena } from '../domain/contrasenas.js';

/**
 * Caso de uso: cambio de contraseña de un manager (ADR-0001). Abarca el flujo
 * completo — validar la actual, validar y guardar la nueva, despejar el flag
 * temporal, invalidar las demás sesiones y refrescar la sesión actual. El
 * adaptador HTTP solo lo invoca.
 */
export class CuentaService {
  constructor(
    private readonly cuentas: CuentaRepository,
    private readonly sessions: SessionStore,
  ) {}

  /** Devuelve el manager actualizado; lanza si la actual no es correcta o la nueva es inválida. */
  async cambiarContrasena(
    manager: Manager,
    token: string,
    actual: string,
    nueva: string,
  ): Promise<Manager> {
    const correcta = await this.cuentas.verificarContrasena(manager.id, actual);
    if (!correcta) throw new Error('La contraseña actual no es correcta.');
    validarNuevaContrasena(actual, nueva);
    const actualizado = await this.cuentas.cambiarContrasena(manager.id, nueva);
    await this.sessions.invalidateOtherSessions(manager.id, token);
    await this.sessions.updateManager(token, actualizado);
    return actualizado;
  }
}