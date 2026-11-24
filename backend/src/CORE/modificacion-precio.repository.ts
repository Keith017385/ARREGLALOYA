import type {
  decidirModificacionPrecio,
  PropuestaPrecio,
} from './decision-modificacion-precio';
import type {
  PropuestaPrecioGuardada,
  PropuestaPrecioNueva,
  ReservaParaProponerPrecio,
} from './propuesta-modificacion-precio';

export type ResultadoDecisionPrecio =
  ReturnType<typeof decidirModificacionPrecio>;

export interface RegistroDecisionPrecio {
  actorId: string;
  decididaEn: Date;
  resultado: ResultadoDecisionPrecio;
}

export interface OperacionesModificacionPrecio {
  obtenerReserva(): Promise<ReservaParaProponerPrecio | null>;
  buscarPropuesta(propuestaId: string): Promise<PropuestaPrecio | null>;
  guardarPropuesta(
    propuesta: PropuestaPrecioNueva,
  ): Promise<PropuestaPrecioGuardada>;
  guardarDecision(registro: RegistroDecisionPrecio): Promise<void>;
}

export interface ModificacionPrecioRepository {
  // PostgreSQL ejecutara estas operaciones en una transaccion por reserva.
  enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesModificacionPrecio) => Promise<T>,
  ): Promise<T>;
}