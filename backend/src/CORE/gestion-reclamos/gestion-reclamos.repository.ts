import type { CausalReclamo, EstadoReclamo } from './gestion-reclamos';

export interface ReclamoResumen {
  reclamoId: string; reservaId: string; reportanteId: string; reportanteNombre: string; descripcion: string;
  estado: Exclude<EstadoReclamo, 'todos'>; presentadoEn: Date; clienteId: string; clienteNombre: string;
  trabajadorId: string; trabajadorNombre: string; inicioProgramado: Date; reservaEstado: string; operacionesVinculadas: number;
}
export interface DeclaracionAsistenciaReclamo { asistenciaId: string; declaradaEn: Date; respuesta: string | null; respondidaEn: Date | null; }
export interface CancelacionReclamo { cancelacionId: string; actorId: string; causalDeclarada: string; motivo: string; solicitadaEn: Date; }
export interface OperacionReclamo {
  solicitudFinancieraId: string; tipo: string; importeSolicitadoCentavos: number; solicitanteId: string;
  solicitanteNombre: string; solicitadaEn: Date; decision: string | null; importeAutorizadoCentavos: number | null;
  compromisoAbierto: boolean; vinculada: boolean;
  movimientos: Array<{ movimientoId: string; estado: string; importeEjecutadoCentavos: number; iniciadoEn: Date; confirmadoEn: Date | null }>;
}
export interface DecisionAdministrativaReclamo {
  decisionId: string; causal: CausalReclamo; resolucion: string; decididaEn: Date; responsableId: string; responsableNombre: string;
}
export interface DetalleReclamo extends ReclamoResumen {
  declaraciones: DeclaracionAsistenciaReclamo[]; cancelaciones: CancelacionReclamo[];
  operaciones: OperacionReclamo[]; decision: DecisionAdministrativaReclamo | null;
}
export interface GestionReclamosRepository {
  listarReclamos(actorId: string, estado: EstadoReclamo): Promise<ReclamoResumen[]>;
  consultarReclamo(actorId: string, reclamoId: string): Promise<DetalleReclamo | null>;
  iniciarRevisionReclamo(actorId: string, reclamoId: string): Promise<{ reclamoId: string; estado: 'en_revision' }>;
  vincularOperacionReclamo(actorId: string, reclamoId: string, solicitudFinancieraId: string): Promise<{ reclamoId: string; solicitudFinancieraId: string; vinculada: true }>;
  resolverReclamo(actorId: string, reclamoId: string, causal: CausalReclamo, resolucion: string): Promise<DecisionAdministrativaReclamo>;
}
