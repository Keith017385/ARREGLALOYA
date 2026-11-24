import { prepararRespuestaOpinion } from '../../CORE/respuesta-opinion/respuesta-opinion';
import type { RespuestaOpinionRepository } from '../../CORE/respuesta-opinion/respuesta-opinion.repository';

export class RespuestaOpinionService {
  constructor(private readonly repositorio: RespuestaOpinionRepository) {}

  async consultarOpinion(calificacionId: string, actorId: string) {
    const opinion = await this.repositorio.consultarOpinion(calificacionId, actorId);
    if (!opinion) {
      throw new Error('No se encontro la calificacion.');
    }
    return opinion;
  }

  async responder(calificacionId: string, actorId: string, respuesta: unknown) {
    const contexto = await this.repositorio.consultarContexto(calificacionId);
    if (!contexto) {
      throw new Error('No se encontro la calificacion.');
    }

    if (contexto.trabajadorId !== actorId || !contexto.trabajadorActivo) {
      throw new Error('Solo el trabajador contratado y activo puede responder la opinion.');
    }

    const texto = prepararRespuestaOpinion(contexto, actorId, respuesta);
    const guardada = await this.repositorio.registrar(calificacionId, actorId, texto);
    if (!guardada) {
      throw new Error('La opinion o el permiso cambio antes de guardar la respuesta.');
    }

    return guardada;
  }
}
