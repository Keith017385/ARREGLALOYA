import { BadRequestException, ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import { CotizacionesRepository } from '../CORE/cotizaciones';
import { SolicitudesService } from './solicitudes.service';

function validarId(id: string): void {
  if (!/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) {
    throw new BadRequestException('Identificador inválido.');
  }
}

@Injectable()
export class CotizacionesService {
  constructor(private readonly repositorio: CotizacionesRepository, private readonly solicitudes: SolicitudesService) {}

  async listar(clienteId: string, solicitudId: string) {
    validarId(solicitudId);
    await this.solicitudes.autorizar(clienteId);
    const ofertas = await this.repositorio.listar(clienteId, solicitudId);
    if (!ofertas) throw new NotFoundException('Solicitud no encontrada.');
    return ofertas;
  }

  async decidir(clienteId: string, solicitudId: string, cotizacionId: string, decision: unknown) {
    validarId(solicitudId);
    validarId(cotizacionId);
    if (decision !== 'aceptada' && decision !== 'rechazada') throw new BadRequestException('Decisión inválida.');
    await this.solicitudes.autorizar(clienteId);
    const resultado = await this.repositorio.decidir(clienteId, solicitudId, cotizacionId, decision);
    if (resultado === 'no-encontrada') throw new NotFoundException('Solicitud no encontrada.');
    if (resultado === 'no-disponible') throw new ConflictException('La cotización ya no está disponible.');
    return { decision };
  }
}
