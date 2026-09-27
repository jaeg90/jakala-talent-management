import type { CambioProyecto, Manager, Project } from '../domain/model.js';
import type {
  MiembrosPorProyecto,
  NuevoCambioProyecto,
  ProyectoRepository,
  SituacionProyecto,
} from '../domain/ports.js';
import {
  validarFechaCambio,
  validarMotivoCambio,
  validarNombreProyecto,
} from '../domain/proyectos.js';

/** Caso de uso: catálogo de proyectos, cambios de proyecto y vista por proyecto. */
export class ProyectoService {
  constructor(private readonly repository: ProyectoRepository) {}

  /** Catálogo de proyectos (compartido). */
  async proyectos(): Promise<Project[]> {
    return this.repository.proyectos();
  }

  /** Da de alta un proyecto con el nombre validado (no vacío). */
  async addProyecto(name: string): Promise<Project> {
    const nombre = validarNombreProyecto(name);
    return this.repository.addProyecto(nombre);
  }

  /** Proyecto actual e historial de cambios de la mentee (solo si es del manager). */
  async situacionDe(manager: Manager, menteeId: string): Promise<SituacionProyecto> {
    return this.repository.situacionDe(manager.id, menteeId);
  }

  /** Registra un cambio de proyecto validando fecha y motivo. */
  async registrarCambio(
    manager: Manager,
    menteeId: string,
    cambio: NuevoCambioProyecto,
  ): Promise<CambioProyecto> {
    const fecha = validarFechaCambio(cambio.fecha);
    const motivo = validarMotivoCambio(cambio.motivo);
    return this.repository.registrarCambio(manager.id, menteeId, {
      fecha,
      destinoId: cambio.destinoId,
      motivo,
    });
  }

  /** Mentees del manager agrupados por su proyecto actual. */
  async miembrosPorProyecto(manager: Manager): Promise<MiembrosPorProyecto[]> {
    return this.repository.miembrosPorProyecto(manager.id);
  }
}