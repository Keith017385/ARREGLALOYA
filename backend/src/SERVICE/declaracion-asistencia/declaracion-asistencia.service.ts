import { prepararRespuestaAsistencia } from '../../CORE/declaracion-asistencia/declaracion-asistencia';
import type { DeclaracionAsistenciaRepository } from '../../CORE/declaracion-asistencia/declaracion-asistencia.repository';

export class DeclaracionAsistenciaService {
  constructor(private readonly repositorio: DeclaracionAsistenciaRepository) {}

  async consultarRechazadas(actorId: string) {
    return this.repositorio.consultarRechazadas(actorId);
  }

  async consultar(reservaId: string, actorId: string) {
    const declaraciones = await this.repositorio.consultarDelCliente(reservaId, actorId);
    if (declaraciones === null) {
      throw new Error('No se encontro la reserva.');
    }
    return declaraciones;
  }

  responder(reservaId: string, asistenciaId: string, actorId: string, respuesta: unknown) {
    return this.repositorio.enReserva(reservaId, async (operaciones) => {
      const declaracion = await operaciones.buscarDeclaracion(asistenciaId);
      if (!declaracion) {
        throw new Error('No se encontro la declaracion en esta reserva.');
      }

      const decision = prepararRespuestaAsistencia(declaracion, actorId, respuesta);
      const guardada = await operaciones.guardarRespuesta(asistenciaId, decision);
      if (!guardada) {
        throw new Error('La declaracion ya tiene una respuesta registrada.');
      }

      return guardada;
    });
  }
}
