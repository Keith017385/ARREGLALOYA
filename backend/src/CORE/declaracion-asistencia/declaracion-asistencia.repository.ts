import type {
  DeclaracionParaResponder,
  RespuestaAsistencia,
} from './declaracion-asistencia';

export interface DeclaracionAsistenciaRegistrada {
  id: string;
  reservaId: string;
  declaradaEn: Date;
  respuesta: RespuestaAsistencia | null;
  respondidaEn: Date | null;
}

export interface RespuestaAsistenciaRegistrada {
  id: string;
  asistenciaId: string;
  respuesta: RespuestaAsistencia;
  respondidaEn: Date;
}

export interface OperacionesAsistencia {
  buscarDeclaracion(asistenciaId: string): Promise<DeclaracionParaResponder | null>;
  guardarRespuesta(
    asistenciaId: string,
    respuesta: RespuestaAsistencia,
  ): Promise<RespuestaAsistenciaRegistrada | null>;
}

export interface AsistenciaRechazada {
  reservaId: string;
  asistenciaId: string;
  respuestaId: string;
  declaradaEn: Date;
  respondidaEn: Date;
}

export interface DeclaracionAsistenciaRepository {
  consultarRechazadas(actorId: string): Promise<AsistenciaRechazada[] | null>;
  enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesAsistencia) => Promise<T>,
  ): Promise<T>;

  consultarDelCliente(
    reservaId: string,
    clienteId: string,
  ): Promise<DeclaracionAsistenciaRegistrada[] | null>;
}
