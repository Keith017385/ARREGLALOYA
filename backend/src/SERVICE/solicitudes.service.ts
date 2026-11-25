import { BadRequestException, ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { CambiosSolicitud, NuevaSolicitud, SolicitudesRepository } from '../CORE/solicitudes';

function texto(valor: unknown, maximo: number): string {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > maximo) {
    throw new BadRequestException('Completa la descripción y la ubicación con valores válidos.');
  }
  return valor.trim();
}

function identificador(valor: unknown): string {
  if (typeof valor !== 'string' || !/^[1-9][0-9]{0,18}$/.test(valor) || BigInt(valor) > 9223372036854775807n) {
    throw new BadRequestException('Selecciona una categoría y una zona válidas.');
  }
  return valor;
}

@Injectable()
export class SolicitudesService {
  constructor(private readonly repositorio: SolicitudesRepository) {}

  async autorizar(usuarioId: string): Promise<void> {
    if (!await this.repositorio.esCliente(usuarioId)) {
      throw new ForbiddenException('Se requiere una cuenta de cliente activa.');
    }
  }

  async opciones(usuarioId: string) {
    await this.autorizar(usuarioId);
    return this.repositorio.zonas();
  }

  async listar(usuarioId: string) {
    await this.autorizar(usuarioId);
    return this.repositorio.listar(usuarioId);
  }

  async historial(usuarioId: string, solicitudId: string) {
    await this.autorizar(usuarioId);
    const historial = await this.repositorio.historial(usuarioId, identificador(solicitudId));
    if (!historial) throw new NotFoundException('Solicitud no encontrada.');
    return historial;
  }

  async modificar(usuarioId: string, solicitudId: string, datos?: Partial<CambiosSolicitud>) {
    await this.autorizar(usuarioId);
    const cambios = { descripcion: texto(datos?.descripcion, 2000), ubicacion: texto(datos?.ubicacion, 500) };
    if (!await this.repositorio.modificar(usuarioId, identificador(solicitudId), cambios)) {
      throw new ConflictException('La solicitud no está disponible para editar.');
    }
    return { id: solicitudId };
  }

  async publicar(usuarioId: string, entrada: Partial<NuevaSolicitud> | undefined) {
    await this.autorizar(usuarioId);
    if (!entrada || !Array.isArray(entrada.servicios) || entrada.servicios.length < 1 || entrada.servicios.length > 2) {
      throw new BadRequestException('Incluye uno o dos servicios.');
    }
    if (entrada.urgente !== undefined && typeof entrada.urgente !== 'boolean') {
      throw new BadRequestException('El indicador de urgencia debe ser verdadero o falso.');
    }
    const datos: NuevaSolicitud = {
      descripcion: texto(entrada.descripcion, 2000),
      ubicacion: texto(entrada.ubicacion, 500),
      zonaId: identificador(entrada.zonaId),
      urgente: entrada.urgente ?? false,
      servicios: entrada.servicios.map(servicio => ({
        categoriaId: identificador(servicio?.categoriaId),
        descripcion: texto(servicio?.descripcion, 2000),
      })),
    };
    try {
      return { id: await this.repositorio.publicar(usuarioId, datos) };
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === '23503') {
        throw new BadRequestException('La zona o la categoría ya no está disponible.');
      }
      throw error;
    }
  }
}
