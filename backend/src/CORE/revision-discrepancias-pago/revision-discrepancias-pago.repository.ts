import type { DatosResolucionPago } from './resolucion-discrepancia-pago';

export interface DeclaracionDePago {
  id: string;
  solicitanteId: string;
  declaracion: string;
  importeReportado: string | null;
  solicitadaEn: string;
}

export interface PagoEnDisputa {
  pagoId: string;
  reservaId: string;
  servicio: string;
  importeDeclarado: string;
  pendienteDesde: Date;
  declaraciones: DeclaracionDePago[];
}

export interface ResolucionPagoRegistrada extends DatosResolucionPago {
  id: string;
  pagoId: string;
  responsableId: string;
  resueltaEn: Date;
  confirmadoEn: Date | null;
}

export interface RevisionDiscrepanciasPagoRepository {
  resolver(
    pagoId: string,
    actorId: string,
    datos: DatosResolucionPago,
  ): Promise<ResolucionPagoRegistrada>;
  listarPendientes(actorId: string): Promise<PagoEnDisputa[] | null>;
}
