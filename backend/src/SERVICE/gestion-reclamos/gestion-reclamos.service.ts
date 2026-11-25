import { prepararFiltroReclamos, prepararResolucionReclamo } from '../../CORE/gestion-reclamos/gestion-reclamos';
import type { GestionReclamosRepository } from '../../CORE/gestion-reclamos/gestion-reclamos.repository';

export class GestionReclamosService {
  constructor(private readonly repositorio: GestionReclamosRepository) {}

  listarReclamos(actorId: string, estado: unknown) {
    return this.repositorio.listarReclamos(actorId, prepararFiltroReclamos(estado));
  }

  consultarReclamo(actorId: string, reclamoId: string) {
    return this.repositorio.consultarReclamo(actorId, reclamoId);
  }

  iniciarRevisionReclamo(actorId: string, reclamoId: string) {
    return this.repositorio.iniciarRevisionReclamo(actorId, reclamoId);
  }

  vincularOperacionReclamo(actorId: string, reclamoId: string, solicitudId: string) {
    return this.repositorio.vincularOperacionReclamo(actorId, reclamoId, solicitudId);
  }

  resolverReclamo(actorId: string, reclamoId: string, causal: unknown, resolucion: unknown) {
    const decision = prepararResolucionReclamo(causal, resolucion);
    return this.repositorio.resolverReclamo(
      actorId, reclamoId, decision.causal, decision.resolucion,
    );
  }
}
