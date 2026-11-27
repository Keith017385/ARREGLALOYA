export type ResultadoAsistencia = 'trabajador_asistio' | 'trabajador_no_asistio';

export interface DatosDictamen {
  respuestaId: string;
  responsableId: string;
  resultado: ResultadoAsistencia;
  explicacion: string;
}

export interface CasoAbierto {
  respuestaId: string;
  reservaId: string;
  estadoReserva: string;
  respondidaEn: string;
  escaladaEn: string | null;
}

export type CodigoDictamen = 'ok' | 'no_encontrado' | 'sin_permiso' | 'ya_resuelta' | 'no_rechazada';

export interface ResultadoDictamen {
  codigo: CodigoDictamen;
  reservaId?: string;
  estadoReserva?: string;
}

export abstract class DictamenAsistenciaRepository {
  abstract listarAbiertos(): Promise<CasoAbierto[]>;
  abstract dictaminar(datos: DatosDictamen): Promise<ResultadoDictamen>;
}