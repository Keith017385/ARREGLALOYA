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
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { AprobacionDesembolsosService } from '../../SERVICE/aprobacion-desembolsos/aprobacion-desembolsos.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

interface CuerpoDecisionDesembolso {
  decision?: unknown;
  importeAutorizadoCentavos?: unknown;
  motivo?: unknown;
}

const MAX_BIGINT_POSTGRES = 9223372036854775807n;

function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string'
    && /^[1-9][0-9]{0,18}$/.test(valor)
    && BigInt(valor) <= MAX_BIGINT_POSTGRES;
}

function obtenerActor(solicitud: SolicitudAutenticada): string {
  const actorId = solicitud.user?.usuarioId;
  if (!esIdValido(actorId)) {
    throw new UnauthorizedException('Inicia sesión para acceder a las funciones administrativas.');
  }
  return actorId;
}

function validarId(valor: unknown, nombre: string): string {
  if (!esIdValido(valor)) {
    throw new BadRequestException(`El identificador de ${nombre} no es válido.`);
  }
  return valor;
}

function traducirError(error: unknown): never {
  if (!(error instanceof Error)) throw error;
  const mensaje = error.message;

  if (mensaje === 'Se requiere un administrador activo.') {
    throw new ForbiddenException(mensaje);
  }
  if (mensaje.startsWith('No se encontró')) {
    throw new NotFoundException(mensaje);
  }
  if (
    mensaje.includes('obligatorio')
    || mensaje.includes('debe tener entre')
    || mensaje.includes('no es válido')
    || mensaje.includes('entero positivo')
    || mensaje.includes('no debe tener un importe')
  ) {
    throw new BadRequestException(mensaje);
  }
  if (
    mensaje.includes('ya fue decidida')
    || mensaje.includes('no corresponde a un desembolso')
    || mensaje.includes('no tiene una reserva asociada')
    || mensaje.includes('no admite desembolsos')
    || mensaje.includes('no tiene un documento')
    || mensaje.includes('reclamo vinculado')
    || mensaje.includes('movimiento financiero asociado')
    || mensaje.includes('fondo disponible')
    || mensaje.includes('máximo disponible')
    || mensaje.includes('supera el importe solicitado')
    || mensaje.includes('importe solicitado')
    || mensaje.includes('condiciones actuales de transferencia')
  ) {
    throw new ConflictException(mensaje);
  }
  throw error;
}

@Controller('administracion')
export class AprobacionDesembolsosController {
  constructor(private readonly servicio: AprobacionDesembolsosService) {}

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
