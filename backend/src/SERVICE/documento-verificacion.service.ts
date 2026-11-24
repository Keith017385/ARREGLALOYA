import { Injectable, NotFoundException } from '@nestjs/common';
import {
  DatosDocumento,
  DocumentoVerificacion,
  DocumentoVerificacionRepository,
} from '../CORE/documento-verificacion';

@Injectable()
export class DocumentoVerificacionService {
  constructor(private readonly repositorio: DocumentoVerificacionRepository) {}

  listar(trabajadorId: string): Promise<DocumentoVerificacion[]> {
    return this.repositorio.listar(trabajadorId);
  }

  async presentar(trabajadorId: string, datos: DatosDocumento): Promise<DocumentoVerificacion> {
    const documento = await this.repositorio.crear(trabajadorId, datos);
    if (!documento) throw new NotFoundException('Trabajador no encontrado.');
    return documento;
  }
}