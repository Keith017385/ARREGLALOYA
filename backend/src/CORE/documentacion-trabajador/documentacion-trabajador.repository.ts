import type { EstadoDocumento, ResultadoDocumento } from './documentacion-trabajador';

export interface DocumentoTrabajador {
  documentoId: string; trabajadorId: string; trabajadorNombre: string; tipo: string;
  referenciaArchivo: string; presentadoEn: Date; resultado: ResultadoDocumento | null;
  motivoRevision: string | null; revisadoEn: Date | null; revisorNombre: string | null;
}
export interface RevisionDocumentoRegistrada {
  revisionId: string; documentoId: string; resultado: ResultadoDocumento; motivo: string; revisadoEn: Date;
}
export interface DocumentacionTrabajadorRepository {
  listarDocumentos(actorId: string, estado: EstadoDocumento): Promise<DocumentoTrabajador[]>;
  revisarDocumento(actorId: string, documentoId: string, resultado: ResultadoDocumento, motivo: string): Promise<RevisionDocumentoRegistrada>;
}
