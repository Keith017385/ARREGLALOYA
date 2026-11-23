export interface OpinionParaResponder {
  trabajadorId: string;
  opinion: string | null;
}

export function prepararRespuestaOpinion(
  calificacion: OpinionParaResponder,
  actorId: string,
  respuesta: unknown,
): string {
  if (calificacion.trabajadorId !== actorId) {
    throw new Error('Solo el trabajador contratado puede responder la opinion.');
  }

  if (!calificacion.opinion?.trim()) {
    throw new Error('La calificacion no tiene una opinion escrita para responder.');
  }

  const texto = typeof respuesta === 'string' ? respuesta.trim() : '';
  if (!texto || texto.includes('\0')) {
    throw new Error('Escribe un texto valido para la respuesta.');
  }

  return texto;
}
