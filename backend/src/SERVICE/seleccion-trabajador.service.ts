import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { SeleccionTrabajadorRepository } from '../CORE/seleccion-trabajador';
import { SolicitudesService } from './solicitudes.service';

function validarId(id: unknown): asserts id is string {
  if (typeof id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) {
    throw new BadRequestException('Identificador inválido.');
  }
}

@Injectable()
export class SeleccionTrabajadorService {
  constructor(private readonly repo: SeleccionTrabajadorRepository, private readonly solicitudes: SolicitudesService) {}

  async buscar(clienteId: string, solicitudId: string) {
    validarId(solicitudId);
    await this.solicitudes.autorizar(clienteId);
    const trabajadores = await this.repo.buscar(clienteId, solicitudId);
    if (!trabajadores) throw new NotFoundException('Solicitud no encontrada.');
    return trabajadores;
  }

  async seleccionar(clienteId: string, solicitudId: string, trabajadorId: unknown) {
    validarId(solicitudId);
    validarId(trabajadorId);
    await this.solicitudes.autorizar(clienteId);
    const resultado = await this.repo.seleccionar(clienteId, solicitudId, trabajadorId);
    if (resultado === 'no-encontrada') throw new NotFoundException('Solicitud no encontrada.');
    if (resultado === 'no-disponible') throw new ConflictException('El trabajador ya no está disponible para esta solicitud.');
    return { trabajadorId };
  }
}
