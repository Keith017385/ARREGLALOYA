import { BadRequestException, Controller, Get, HttpCode, Param, Post } from '@nestjs/common';
import { CuentaTrabajadorService } from '../SERVICE/cuenta-trabajador.service';

// Un id válido son solo dígitos (bigint de PostgreSQL, máximo 19).
function validarId(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^\d{1,19}$/.test(valor)) {
    throw new BadRequestException(`${campo} no es válido.`);
  }
  return valor;
}

@Controller('trabajadores')
export class CuentaTrabajadorController {
  constructor(private readonly servicio: CuentaTrabajadorService) {}

  @Get(':usuarioId/cuenta')
  obtenerCuenta(@Param('usuarioId') usuarioId: string) {
    return this.servicio.obtenerCuenta(validarId(usuarioId, 'El trabajador'));
  }

  @Post(':usuarioId/cuenta/suspension')
  @HttpCode(200)
  suspender(@Param('usuarioId') usuarioId: string) {
    return this.servicio.suspender(validarId(usuarioId, 'El trabajador'));
  }

  @Post(':usuarioId/cuenta/reactivacion')
  @HttpCode(200)
  reactivar(@Param('usuarioId') usuarioId: string) {
    return this.servicio.reactivar(validarId(usuarioId, 'El trabajador'));
  }
}