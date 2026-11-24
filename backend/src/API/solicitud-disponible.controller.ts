import { BadRequestException, Controller, Get, Param } from '@nestjs/common';
import { SolicitudDisponibleService } from '../SERVICE/solicitud-disponible.service';

// Un id válido son solo dígitos (bigint de PostgreSQL, máximo 19).
function validarId(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^\d{1,19}$/.test(valor)) {
    throw new BadRequestException(`${campo} no es válido.`);
  }
  return valor;
}

@Controller('trabajadores')
export class SolicitudDisponibleController {
  constructor(private readonly servicio: SolicitudDisponibleService) {}

  @Get(':usuarioId/solicitudes')
  listarSolicitudes(@Param('usuarioId') usuarioId: string) {
    return this.servicio.listar(validarId(usuarioId, 'El trabajador'));
  }
}