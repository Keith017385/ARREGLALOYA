import {
  prepararResolucionEscalada,
  validarEscalamientoAsistencia,
} from '../../CORE/casos-escalados/gestion-revision-asistencia';
import type { GestionRevisionAsistenciaRepository } from '../../CORE/casos-escalados/gestion-revision-asistencia.repository';

import { vencioPlazoRevisionAsistencia } from '../../CORE/casos-escalados/plazo-revision-asistencia';

export class GestionRevisionAsistenciaService {
  constructor(private readonly repositorio: GestionRevisionAsistenciaRepository) {}

  async listarAbiertas(actorId: string) {
    const bandeja = await this.repositorio.listarAbiertas(actorId);
    if (bandeja === null) {
      throw new Error('Se requiere un superadministrador activo.');
    }

    return bandeja.revisiones.map((revision) => {
      let estado: 'en_revision' | 'vencida' | 'escalada' = 'en_revision';

      if (revision.escaladaEn !== null) {
        estado = 'escalada';
      } else if (vencioPlazoRevisionAsistencia(revision.rechazadaEn, bandeja.ahora)) {
        estado = 'vencida';
      }

      return { ...revision, estado };
    });
  }

  escalar(respuestaId: string, actorId: string) {
    return this.repositorio.actualizar(respuestaId, actorId, (revision, ahora) => {
      validarEscalamientoAsistencia(revision, ahora);
      return { tipo: 'escalar' };
    });
  }

  resolver(respuestaId: string, actorId: string, resolucion: unknown) {
    return this.repositorio.actualizar(respuestaId, actorId, (revision) => ({
      tipo: 'resolver',
      resolucion: prepararResolucionEscalada(revision, resolucion),
    }));
  }
}
