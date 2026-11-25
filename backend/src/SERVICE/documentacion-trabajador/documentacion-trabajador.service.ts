import { prepararFiltroDocumentacion, prepararRevisionDocumento } from '../../CORE/documentacion-trabajador/documentacion-trabajador';
import type { DocumentacionTrabajadorRepository } from '../../CORE/documentacion-trabajador/documentacion-trabajador.repository';

export class DocumentacionTrabajadorService {
  constructor(private readonly repositorio: DocumentacionTrabajadorRepository) {}

  listarDocumentos(actorId: string, estado: unknown) {
    const filtro = prepararFiltroDocumentacion(estado);
    return this.repositorio.listarDocumentos(actorId, filtro);
  }

  revisarDocumento(actorId: string, documentoId: string, resultado: unknown, motivo: unknown) {
    const revision = prepararRevisionDocumento(resultado, motivo);
    return this.repositorio.revisarDocumento(
      actorId, documentoId, revision.resultado, revision.motivo,
    );
  }
}
