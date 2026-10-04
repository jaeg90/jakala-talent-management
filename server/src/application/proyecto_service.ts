import type {
  Asignacion,
  CambioProyecto,
  Manager,
  Project,
  ProyectoCatalogo,
  ProyectoConEstado,
} from '../domain/model.js';
import type {
  NuevaAsignacion,
  NuevoCambioProyecto,
  ProyectoActual,
  ProyectoRepository,
  SalidaDeProyecto,
  SituacionProyecto,
} from '../domain/ports.js';
import {
  validarFechaCambio,
  validarMotivoCambio,
  validarNombreProyecto,
} from '../domain/proyectos.js';
import { validarFechaAsignacion, validarMotivoAsignacion } from '../domain/asignaciones.js';

/** Caso de uso: catálogo de proyectos y asignaciones de una mentee. */
export class ProyectoService {
  constructor(private readonly repository: ProyectoRepository) {}

  /** Catálogo completo de proyectos (vigentes y retirados). */
  async proyectos(): Promise<ProyectoCatalogo[]> {
    return this.repository.proyectos();
  }

  /** Nombre recortado, no vacío y único en todo el catálogo, incluidos retirados. */
  async addProyecto(name: string): Promise<Project> {
    const nombre = validarNombreProyecto(name, await this.repository.proyectos());
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

  /** Proyectos vigentes de una mentee (solo si es del manager). */
  async proyectosActuales(manager: Manager, menteeId: string): Promise<ProyectoActual[]> {
    return this.repository.proyectosActualesDe(manager.id, menteeId);
  }

  /** Entra a una mentee en un proyecto validando fecha y motivo. */
  async entrarEnProyecto(
    manager: Manager,
    menteeId: string,
    entrada: NuevaAsignacion,
  ): Promise<Asignacion> {
    const desde = validarFechaAsignacion(entrada.desde);
    const motivoEntrada = validarMotivoAsignacion(entrada.motivoEntrada);
    return this.repository.entrarEnProyecto(manager.id, menteeId, {
      proyecto: entrada.proyecto,
      desde,
      motivoEntrada,
    });
  }

  /** Saca a una mentee de un proyecto validando fecha y motivo. */
  async salirDeProyecto(
    manager: Manager,
    menteeId: string,
    proyectoId: string,
    salida: SalidaDeProyecto,
  ): Promise<Asignacion> {
    const hasta = validarFechaAsignacion(salida.hasta);
    const motivoSalida = validarMotivoAsignacion(salida.motivoSalida);
    return this.repository.salirDeProyecto(manager.id, menteeId, proyectoId, {
      hasta,
      motivoSalida,
    });
  }

  /** Retira un proyecto vigente del catálogo (fechaRetirada = hoy). */
  async retirarProyecto(proyectoId: string): Promise<ProyectoConEstado> {
    return this.repository.retirarProyecto(proyectoId);
  }

  /** Reactiva un proyecto retirado (fechaRetirada = null). */
  async reactivarProyecto(proyectoId: string): Promise<ProyectoConEstado> {
    return this.repository.reactivarProyecto(proyectoId);
  }
}
