import type { RevisionAsistencia } from './gestion-revision-asistencia';

export type CambioRevisionAsistencia =
  | { tipo: 'escalar' }
  | { tipo: 'resolver'; resolucion: string };

export interface GestionAsistenciaRegistrada {
  respuestaId: string;
  escaladaEn: Date | null;
  resueltaEn: Date | null;
  responsableId: string | null;
  resolucion: string | null;
}

export interface RevisionAsistenciaAbierta {
  respuestaId: string;
  asistenciaId: string;
  reservaId: string;
  declaradaEn: Date;
  rechazadaEn: Date;
  escaladaEn: Date | null;
}

export interface BandejaRevisionAsistencia {
  ahora: Date;
  revisiones: RevisionAsistenciaAbierta[];
}

export interface GestionRevisionAsistenciaRepository {
  listarAbiertas(actorId: string): Promise<BandejaRevisionAsistencia | null>;
  actualizar(
    respuestaId: string,
    actorId: string,
    decidir: (revision: RevisionAsistencia, ahora: Date) => CambioRevisionAsistencia,
  ): Promise<GestionAsistenciaRegistrada>;
}
