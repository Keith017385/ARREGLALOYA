import type {
  CodigoParaFinalizacion,
  ReservaParaFinalizacion,
} from './confirmacion-finalizacion';

export interface CodigoRegistrado extends CodigoParaFinalizacion {
  id: string;
}

export interface FinalizacionRegistrada {
  id: string;
  confirmadaEn: Date;
}

export interface OperacionesFinalizacion {
  obtenerReserva(): Promise<ReservaParaFinalizacion | null>;
  buscarCodigoPorHash(hash: string): Promise<CodigoRegistrado | null>;
  registrarFinalizacion(codigoId: string): Promise<FinalizacionRegistrada>;
  marcarReservaFinalizada(): Promise<void>;
}

export interface FinalizacionRepository {
  // En PostgreSQL, el adaptador bloquea la reserva antes de leer el código.
  // Las dos escrituras se confirman juntas o se revierten juntas.
  enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesFinalizacion) => Promise<T>,
  ): Promise<T>;
}