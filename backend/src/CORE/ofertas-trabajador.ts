export interface OfertaTrabajador {
  id: string;
  solicitudId: string;
  descripcion: string;
  estado: string;
  visitaId: string | null;
  estadoVisita: string | null;
  visitaProgramada: Date | null;
  cotizacionId: string | null;
  reservaId: string | null;
  decision: string | null;
}

export interface NuevaCotizacion {
  manoObra: string;
  materiales: string;
  transporte: string;
  venceEn: Date;
}

export abstract class OfertasTrabajadorRepository {
  abstract listar(trabajadorId: string): Promise<OfertaTrabajador[]>;
  abstract presentar(trabajadorId: string, solicitudId: string): Promise<string>;
  abstract programarVisita(trabajadorId: string, ofertaId: string, fecha: Date): Promise<string>;
  abstract registrarVisita(trabajadorId: string, ofertaId: string): Promise<void>;
  abstract cotizar(trabajadorId: string, ofertaId: string, datos: NuevaCotizacion): Promise<string>;
}
