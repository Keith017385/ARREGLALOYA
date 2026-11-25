import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Query,
  Req,
  UnauthorizedException,
} from '@nestjs/common';

interface SolicitudAutenticada { user?: { usuarioId?: unknown }; }
const MAX_BIGINT_POSTGRES = 9223372036854775807n;
function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[1-9][0-9]{0,18}$/.test(valor)
    && BigInt(valor) <= MAX_BIGINT_POSTGRES;
}
function obtenerActor(solicitud: SolicitudAutenticada): string {
  const actorId = solicitud.user?.usuarioId;
  if (!esIdValido(actorId)) throw new UnauthorizedException('Inicia sesión para acceder a las funciones administrativas.');
  return actorId;
}
function validarId(valor: unknown, nombre: string): string {
  if (!esIdValido(valor)) throw new BadRequestException(`El identificador de ${nombre} no es válido.`);
  return valor;
}
function traducirError(error: unknown): never {
  if (!(error instanceof Error)) throw error;
  const mensaje = error.message;
  if (mensaje === 'Se requiere un administrador activo.' || mensaje === 'Se requiere administrador activo' || mensaje === 'Aprobación sin administrador activo') throw new ForbiddenException(mensaje);
  if (mensaje.startsWith('No se encontró')) throw new NotFoundException(mensaje);
  if (mensaje.includes('obligatorio') || mensaje.includes('debe tener entre') || mensaje.includes('no es válido') || mensaje.includes('debe ser') || mensaje.includes('no debe tener')) throw new BadRequestException(mensaje);
  if (mensaje.includes('ya fue') || mensaje.includes('ya tiene') || mensaje.includes('no se pueden') || mensaje.includes('no pertenece') || mensaje.includes('no corresponde') || mensaje.includes('supera el importe disponible') || mensaje.includes('Autorización superior') || mensaje.includes('Conciliar compromisos')) throw new ConflictException(mensaje);
  throw error;
}

interface CuerpoDecisionDesembolso { decision?: unknown; importeAutorizadoCentavos?: unknown; motivo?: unknown; }

import { AprobacionDesembolsosService } from '../../SERVICE/aprobacion-desembolsos/aprobacion-desembolsos.service';

@Controller('administracion')
export class AprobacionDesembolsosController {
  constructor(private readonly servicio: AprobacionDesembolsosService) {}

  // CU-23: decidir solicitudes. La transferencia se ejecuta en un flujo diferente.
  @Get('desembolsos')
  @Header('Cache-Control', 'no-store')
  async listarDesembolsos(@Req() solicitud: SolicitudAutenticada) {
    const actorId = obtenerActor(solicitud);
    try {
      return await this.servicio.listarDesembolsos(actorId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post('desembolsos/:solicitudId/decision')
  async decidirDesembolso(
    @Req() solicitud: SolicitudAutenticada,
    @Param('solicitudId') solicitudId: string,
    @Body() cuerpo: CuerpoDecisionDesembolso | undefined,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(solicitudId, 'solicitud financiera');
    try {
      return await this.servicio.decidirDesembolso(
        actorId,
        solicitudId,
        cuerpo?.decision,
        cuerpo?.importeAutorizadoCentavos,
        cuerpo?.motivo,
      );
    } catch (error) {
      traducirError(error);
    }
  }
}
