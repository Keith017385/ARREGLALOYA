export type EstadoApelacion = 'pendiente' | 'aprobada' | 'rechazada';
export type DecisionApelacion = 'aprobada' | 'rechazada';

export interface EvidenciaApelacionNueva {
  nombreArchivo: string;
  contenido: Uint8Array;
}

export interface EvidenciaApelacion {
  evidenciaId: string;
  nombreArchivo: string;
  cargadaEn: Date;
}

export interface HistorialDecisionApelacion {
  decisionId: string;
  decision: DecisionApelacion;
  fundamento: string;
  decididaPorId: string;
  decididaEn: Date;
}

export interface ApelacionSancion {
  apelacionId: string;
  sancionId: string;
  solicitadaPorId: string;
  justificacion: string;
  estado: EstadoApelacion;
  solicitadaEn: Date;
  evidencias: EvidenciaApelacion[];
  historial: HistorialDecisionApelacion[];
}
export interface SancionPropia {
  sancionId: string;
  motivo: string;
  inicio: Date;
  fin: Date;
  estadoApelacion: EstadoApelacion | null;
}