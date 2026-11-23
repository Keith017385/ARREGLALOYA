import type { DatosCalificacion, ReservaParaCalificacion } from './calificacion-opinion';

export interface CalificacionRegistrada extends DatosCalificacion {
  id: string;
  reservaId: string;
  version: number;
  registradaEn: Date;
}

export interface OperacionesCalificacion {
  obtenerReserva(): Promise<ReservaParaCalificacion | null>;
  registrar(datos: DatosCalificacion): Promise<CalificacionRegistrada>;
}

export interface CalificacionOpinionRepository {
  enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesCalificacion) => Promise<T>,
  ): Promise<T>;
}
