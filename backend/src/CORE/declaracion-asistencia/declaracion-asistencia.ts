export type RespuestaAsistencia = 'confirmada' | 'rechazada';

export interface DeclaracionParaResponder {
  clienteId: string;
  respuesta: RespuestaAsistencia | null;
}

export function prepararRespuestaAsistencia(
  declaracion: DeclaracionParaResponder,
  actorId: string,
  respuesta: unknown,
): RespuestaAsistencia {
  if (declaracion.clienteId !== actorId) {
    throw new Error('Solo el cliente de la reserva puede responder la declaracion.');
  }

  if (declaracion.respuesta !== null) {
    throw new Error('La declaracion ya tiene una respuesta registrada.');
  }

  if (respuesta !== 'confirmada' && respuesta !== 'rechazada') {
    throw new Error('La respuesta debe ser confirmada o rechazada.');
  }

  return respuesta;
}
