import { vencioPlazoRevisionAsistencia } from './plazo-revision-asistencia';

export interface RevisionAsistencia {
  respuesta: 'confirmada' | 'rechazada';
  respondidaEn: Date;
  escaladaEn: Date | null;
  resueltaEn: Date | null;
}

export function validarEscalamientoAsistencia(revision: RevisionAsistencia, ahora: Date): void {
  validarRevisionAbierta(revision);

  if (revision.escaladaEn !== null) {
    throw new Error('La revision ya fue escalada.');
  }

  if (!vencioPlazoRevisionAsistencia(revision.respondidaEn, ahora)) {
    throw new Error('El plazo de revision administrativa aun no vencio.');
  }
}

export function prepararResolucionEscalada(revision: RevisionAsistencia, resolucion: unknown): string {
  validarRevisionAbierta(revision);

  if (revision.escaladaEn === null) {
    throw new Error('La revision aun no fue escalada.');
  }

  const texto = typeof resolucion === 'string' ? resolucion.trim() : '';
  if (!texto || [...texto].length > 2000 || texto.includes('\0')) {
    throw new Error('La resolucion debe contener entre 1 y 2000 caracteres validos.');
  }

  return texto;
}

function validarRevisionAbierta(revision: RevisionAsistencia): void {
  if (revision.respuesta !== 'rechazada') {
    throw new Error('Solo una asistencia rechazada puede pasar a revision.');
  }

  if (revision.resueltaEn !== null) {
    throw new Error('La revision ya fue resuelta.');
  }
}
