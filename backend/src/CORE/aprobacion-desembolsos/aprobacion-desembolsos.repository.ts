import type { DecisionDesembolso } from './aprobacion-desembolsos';

export interface SolicitudDesembolsoPendiente {
  solicitudFinancieraId: string;
  reservaId: string;
  trabajadorId: string;
  trabajadorNombre: string;
  clienteNombre: string;
  importeSolicitadoCentavos: number;
  disponibleCentavos: number;
  importeMaximoAutorizableCentavos: number;
  solicitadaEn: Date;
  reservaEstado: string;
  documentoDisponible: boolean;
  reclamoEnRevision: boolean;
  movimientoExistente: boolean;
  puedeAprobar: boolean;
  motivosBloqueo: string[];
}

export interface DecisionDesembolsoRegistrada {
  decisionFinancieraId: string;
  solicitudFinancieraId: string;
  decision: DecisionDesembolso;
  importeAutorizadoCentavos: number | null;
  motivo: string;
  decididaEn: Date;
}

export interface AprobacionDesembolsosRepository {
  listarDesembolsos(actorId: string): Promise<SolicitudDesembolsoPendiente[]>;
  decidirDesembolso(
    actorId: string,
    solicitudFinancieraId: string,
    decision: DecisionDesembolso,
    importeAutorizadoCentavos: number | null,
    motivo: string,
  ): Promise<DecisionDesembolsoRegistrada>;
}
