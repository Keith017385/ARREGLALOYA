export interface ReservaParaCalificacion {
  clienteId: string;
  estado: string;
}

export interface DatosCalificacion {
  puntuacion: number;
  opinion: string | null;
}

export function prepararCalificacion(
  reserva: ReservaParaCalificacion,
  actorId: string,
  puntuacion: unknown,
  opinion?: unknown,
): DatosCalificacion {
  if (reserva.clienteId !== actorId) {
    throw new Error('Solo el cliente de la reserva puede calificar el servicio.');
  }

  if (reserva.estado !== 'finalizada') {
    throw new Error('Solo se puede calificar un servicio finalizado.');
  }

  if (typeof puntuacion !== 'number' || !Number.isFinite(puntuacion) || puntuacion < 0) {
    throw new Error('La puntuacion debe ser un numero finito mayor o igual a cero.');
  }

  if (opinion != null && typeof opinion !== 'string') {
    throw new Error('La opinion debe ser un texto.');
  }

  return {
    puntuacion,
    opinion: typeof opinion === 'string' ? opinion.trim() || null : null,
  };
}
