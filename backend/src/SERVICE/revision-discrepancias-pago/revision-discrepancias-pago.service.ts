import type { RevisionDiscrepanciasPagoRepository } from '../../CORE/revision-discrepancias-pago/revision-discrepancias-pago.repository';

import { prepararResolucionPago } from '../../CORE/revision-discrepancias-pago/resolucion-discrepancia-pago';

export class RevisionDiscrepanciasPagoService {
  constructor(private readonly repositorio: RevisionDiscrepanciasPagoRepository) {}

  async resolver(pagoId: string, actorId: string, resultado: unknown, motivo: unknown) {
    const datos = prepararResolucionPago(resultado, motivo);
    return this.repositorio.resolver(pagoId, actorId, datos);
  }

  async listarPendientes(actorId: string) {
    const casos = await this.repositorio.listarPendientes(actorId);

    if (casos === null) {
      throw new Error('Se requiere un administrador activo.');
    }

    return casos;
  }
}
