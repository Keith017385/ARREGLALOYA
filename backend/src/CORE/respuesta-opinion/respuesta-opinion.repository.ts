import type { OpinionParaResponder } from './respuesta-opinion';

export interface ContextoRespuestaOpinion extends OpinionParaResponder {
  trabajadorActivo: boolean;
}

export interface RespuestaOpinionRegistrada {
  id: string;
  calificacionId: string;
  autorId: string;
  texto: string;
  registradaEn: Date;
}

export interface DetalleOpinion {
  calificacionId: string;
  reservaId: string;
  opinion: string | null;
  puedeResponder: boolean;
  respuestas: (Omit<RespuestaOpinionRegistrada, 'calificacionId' | 'registradaEn'> & {
    registradaEn: string;
  })[];
}

export interface RespuestaOpinionRepository {
  consultarOpinion(calificacionId: string, actorId: string): Promise<DetalleOpinion | null>;
  consultarContexto(calificacionId: string): Promise<ContextoRespuestaOpinion | null>;

  registrar(
    calificacionId: string,
    actorId: string,
    texto: string,
  ): Promise<RespuestaOpinionRegistrada | null>;
}
