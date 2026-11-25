import { prepararDecisionDesembolso } from '../../CORE/aprobacion-desembolsos/aprobacion-desembolsos';
import type { AprobacionDesembolsosRepository } from '../../CORE/aprobacion-desembolsos/aprobacion-desembolsos.repository';

export class AprobacionDesembolsosService {
  constructor(private readonly repositorio: AprobacionDesembolsosRepository) {}

  listarDesembolsos(actorId: string) {
    return this.repositorio.listarDesembolsos(actorId);
  }

  decidirDesembolso(
    actorId: string,
    solicitudId: string,
    decision: unknown,
    importeAutorizadoCentavos: unknown,
    motivo: unknown,
  ) {
    const datos = prepararDecisionDesembolso(decision, importeAutorizadoCentavos, motivo);
    return this.repositorio.decidirDesembolso(
      actorId,
      solicitudId,
      datos.decision,
      datos.importeAutorizadoCentavos,
      datos.motivo,
    );
  }
}
