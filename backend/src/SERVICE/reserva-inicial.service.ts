import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { ReservaInicialRepository } from '../CORE/reserva-inicial';
import { SolicitudesService } from './solicitudes.service';

@Injectable()
export class ReservaInicialService {
  constructor(private readonly repo: ReservaInicialRepository, private readonly solicitudes: SolicitudesService) {}

  private async autorizar(clienteId: string, cotizacionId: string) {
    if (!/^[1-9][0-9]{0,18}$/.test(cotizacionId) || BigInt(cotizacionId) > 9223372036854775807n) {
      throw new BadRequestException('La cotización no es válida.');
    }
    await this.solicitudes.autorizar(clienteId);
  }

  async consultar(clienteId: string, cotizacionId: string) {
    await this.autorizar(clienteId, cotizacionId);
    const resumen = await this.repo.consultar(clienteId, cotizacionId);
    if (!resumen) throw new NotFoundException('Cotización aceptada no disponible.');
    return resumen;
  }

  async crear(clienteId: string, cotizacionId: string, fecha: unknown) {
    await this.autorizar(clienteId, cotizacionId);
    if (typeof fecha !== 'string' || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{3})?Z$/.test(fecha)) {
      throw new BadRequestException('Selecciona una fecha y hora válidas.');
    }
    const inicio = new Date(fecha);
    if (!Number.isFinite(inicio.getTime()) || inicio.getTime() <= Date.now()) {
      throw new BadRequestException('El inicio debe ser posterior a la fecha actual.');
    }
    const resumen = await this.repo.crear(clienteId, cotizacionId, inicio);
    if (!resumen) throw new NotFoundException('Cotización aceptada no disponible.');
    return resumen;
  }
}
