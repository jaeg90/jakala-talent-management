import type { Manager } from '../domain/model.js';
import type { CuentaRepository, SessionStore } from '../domain/ports.js';
import { generarContrasenaTemporal, validarNuevaContrasena } from '../domain/contrasenas.js';

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

  async managers() {
    return this.cuentas.managers();
  }

  async crearManager(name: string, email: string) {
    const nombre = name.trim();
    if (nombre === '') throw new Error('Escribe el nombre y apellidos.');
    // Solo plegamos mayúsculas ASCII: Unicode como K no puede convertirse en un email válido.
    const correo = email.trim().replace(/[A-Z]/g, (letra) => letra.toLowerCase());
    // Parte local sin puntos vacíos y dominio con etiquetas no vacías,
    // alfanuméricas en los extremos (sin guiones iniciales/finales).
    if (!/^[a-z0-9!#$%&'*+/=?^_`{|}~-]+(?:\.[a-z0-9!#$%&'*+/=?^_`{|}~-]+)*@[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]{0,61}[a-z0-9])?)+$/.test(correo)) {
      throw new Error('Escribe un email válido.');
    }
    const contrasenaTemporal = generarContrasenaTemporal();
    const manager = await this.cuentas.crearManager(nombre, correo, contrasenaTemporal);
    return { manager, contrasenaTemporal };
  }

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
