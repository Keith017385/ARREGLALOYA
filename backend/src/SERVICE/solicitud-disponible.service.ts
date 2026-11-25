import { Injectable, NotFoundException } from '@nestjs/common';
import { SolicitudDisponible } from '../CORE/solicitud-disponible';
import { PostgresSolicitudDisponibleRepository } from '../INFRASTRUCTURE/postgres-solicitud-disponible.repository';

@Injectable()
export class SolicitudDisponibleService {
  constructor(private readonly repositorio: PostgresSolicitudDisponibleRepository) {}

  async listar(trabajadorId: string): Promise<SolicitudDisponible[]> {
    if (!/^\d+$/.test(trabajadorId)) {
      throw new NotFoundException('Trabajador no encontrado.');
    }
    return this.repositorio.listarDisponibles(trabajadorId);
  }
}