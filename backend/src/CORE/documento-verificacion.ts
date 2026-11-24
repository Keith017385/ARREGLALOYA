// Tipos de documento que acepta el sistema (se pueden ampliar aquí).
export const TIPOS_DOCUMENTO = ['carnet', 'certificado'] as const;

export type EstadoDocumento = 'pendiente' | 'aprobado' | 'rechazado' | 'requiere_informacion';

export interface DocumentoVerificacion {
  id: string;
  tipo: string;
  referenciaArchivo: string;
  presentadoEn: Date;
  estado: EstadoDocumento;
  motivo: string | null;
  revisadoEn: Date | null;
}

export interface DatosDocumento {
  tipo: string;
  referenciaArchivo: string;
}

// Contrato que permite probar el caso de uso sin conectarse a PostgreSQL.
export abstract class DocumentoVerificacionRepository {
  abstract listar(trabajadorId: string): Promise<DocumentoVerificacion[]>;
  abstract crear(trabajadorId: string, datos: DatosDocumento): Promise<DocumentoVerificacion | null>;
}