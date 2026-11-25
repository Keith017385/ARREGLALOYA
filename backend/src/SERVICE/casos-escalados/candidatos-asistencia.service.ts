import type { CandidatosAsistenciaRepository } from '../../CORE/casos-escalados/candidatos-asistencia.repository';

/** Caso de uso que delega la consulta de candidatos al contrato CORE. */
export class CandidatosAsistenciaService {
  constructor(private readonly repositorio: CandidatosAsistenciaRepository) {}

  listarVencidos(actorId: string) {
    return this.repositorio.listarVencidos(actorId);
  }
}
