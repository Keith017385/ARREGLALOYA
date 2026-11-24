export type EstadoDocumento = 'pendiente' | 'aprobado' | 'rechazado' | 'requiere_informacion';

export interface DocumentoTrabajador {
  id: string;
  tipo: string;
  referenciaArchivo: string;
  presentadoEn: string;
  estado: EstadoDocumento;
  motivo: string | null;
  revisadoEn: string | null;
}

export interface DatosDocumento {
  tipo: string;
  referenciaArchivo: string;
}

// Mismos tipos que acepta el backend.
export const TIPOS_DOCUMENTO = [
  { valor: 'carnet', etiqueta: 'Carnet de identidad' },
  { valor: 'certificado', etiqueta: 'Certificado' }
];