export type ResultadoAsistencia = 'trabajador_asistio' | 'trabajador_no_asistio';

export interface CasoAbierto {
  respuestaId: string;
  reservaId: string;
  estadoReserva: string;
  respondidaEn: string;
  escaladaEn: string | null;
}

export interface DatosDictamen {
  responsableId: string;
  resultado: ResultadoAsistencia;
  explicacion: string;
}