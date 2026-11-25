/** Consulta de candidatos para revision de asistencia. */
export interface CandidatoAsistencia {
  respuestaId: string;
  asistenciaId: string;
  reservaId: string;
  rechazadaEn: Date;
  fechaVencimientoBolivia: string;
}

export interface CandidatosAsistenciaRepository {
  listarVencidos(actorId: string): Promise<CandidatoAsistencia[] | null>;
}
