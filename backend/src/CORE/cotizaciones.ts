export type DecisionCotizacion = 'aceptada' | 'rechazada';

export interface OfertaCotizacion {
  ofertaId: string;
  trabajador: string;
  estadoOferta: string;
  cotizacionId: string | null;
  precio: string | null;
  venceEn: Date | null;
  decision: DecisionCotizacion | null;
  disponible: boolean;
}

export abstract class CotizacionesRepository {
  abstract listar(clienteId: string, solicitudId: string): Promise<OfertaCotizacion[] | null>;
  abstract decidir(clienteId: string, solicitudId: string, cotizacionId: string, decision: DecisionCotizacion): Promise<'registrada' | 'no-encontrada' | 'no-disponible'>;
}
