import { prepararCalificacion } from '../../CORE/calificacion-opinion/calificacion-opinion';
import type { CalificacionOpinionRepository } from '../../CORE/calificacion-opinion/calificacion-opinion.repository';

export class CalificacionOpinionService {
  constructor(private readonly repositorio: CalificacionOpinionRepository) {}

  registrar(reservaId: string, actorId: string, puntuacion: unknown, opinion?: unknown) {
    return this.repositorio.enReserva(reservaId, async (operaciones) => {
      const reserva = await operaciones.obtenerReserva();
      if (!reserva) {
        throw new Error('No se encontro la reserva.');
      }

      const datos = prepararCalificacion(reserva, actorId, puntuacion, opinion);
      return operaciones.registrar(datos);
    });
  }
}
