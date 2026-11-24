export type EstadoDocumento = 'pendiente' | 'aprobado' | 'rechazado' | 'requiere_informacion' | 'todos';
export type ResultadoDocumento = 'aprobado' | 'rechazado' | 'requiere_informacion';

export interface DatosRevisionDocumento {
  resultado: ResultadoDocumento;
  motivo: string;
}

const RESULTADOS_PERMITIDOS: ResultadoDocumento[] = [
  'aprobado',
  'rechazado',
  'requiere_informacion',
];

/** Valida la decisión y el fundamento antes de persistir la revisión documental. */
export function prepararRevisionDocumento(resultado: unknown, motivo: unknown): DatosRevisionDocumento {
  if (typeof resultado !== 'string' || !RESULTADOS_PERMITIDOS.includes(resultado as ResultadoDocumento)) {
    throw new Error('El resultado de revisión documental no es válido.');
  }

  if (typeof motivo !== 'string') {
    throw new Error('El motivo de revisión es obligatorio.');
  }

  const justificacion = motivo.trim();
  if (!justificacion || justificacion.length > 2000 || justificacion.includes('\0')) {
    throw new Error('El motivo de revisión debe tener entre 1 y 2000 caracteres.');
  }

  return { resultado: resultado as ResultadoDocumento, motivo: justificacion };
}

/** Normaliza el filtro de la bandeja administrativa; por defecto muestra pendientes. */
export function prepararFiltroDocumentacion(valor: unknown): EstadoDocumento {
  const filtro = valor == null || valor === '' ? 'pendiente' : valor;
  const permitidos: EstadoDocumento[] = [
    'pendiente', 'aprobado', 'rechazado', 'requiere_informacion', 'todos',
  ];
  if (typeof filtro !== 'string' || !permitidos.includes(filtro as EstadoDocumento)) {
    throw new Error('El filtro de documentación no es válido.');
  }
  return filtro as EstadoDocumento;
}
