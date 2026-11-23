import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import type { LiquidacionCancelacionCliente } from '../../CORE/cancelacion-cliente/cancelacion-cliente.repository';
import { CancelacionClienteService } from '../../SERVICE/cancelacion-cliente/cancelacion-cliente.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

interface ConfirmacionCancelacion {
  motivo?: unknown;
  vistaPrevia?: LiquidacionCancelacionCliente;
}

function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string'
    && /^[1-9][0-9]{0,18}$/.test(valor)
    && BigInt(valor) <= 9223372036854775807n;
}

function validarSolicitud(solicitud: SolicitudAutenticada, reservaId: string): string {
  const actorId = solicitud.user?.usuarioId;
  if (!esIdValido(actorId)) {
    throw new UnauthorizedException('Inicia sesion para gestionar la cancelacion.');
  }
  if (!esIdValido(reservaId)) {
    throw new BadRequestException('El identificador de reserva no es valido.');
  }
  return actorId;
}

function traducirError(error: unknown): never {
  if (!(error instanceof Error)) {
    throw error;
  }

  switch (error.message) {
    case 'No se encontro la reserva.':
      throw new NotFoundException(error.message);
    case 'El motivo de cancelacion es obligatorio.':
    case 'Confirma con una vista previa valida.':
      throw new BadRequestException(error.message);
    case 'La reserva no esta disponible para cancelacion por el cliente.':
    case 'La cancelacion debe solicitarse antes del inicio programado.':
    case 'Hay compromisos o movimientos abiertos que deben conciliarse antes de cancelar.':
    case 'La vista previa cambio. Consulta el resultado antes de confirmar.':
      throw new ConflictException(error.message);
    case 'Conciliar compromisos y ejecuciones abiertas antes de liquidar':
      throw new ConflictException(
        'Hay compromisos o movimientos abiertos que deben conciliarse antes de cancelar.',
      );
    default:
      throw error;
  }
}

@Controller('reservas/:reservaId/cancelacion')
export class CancelacionClienteController {
  constructor(private readonly servicio: CancelacionClienteService) {}

  @Get('vista-previa')
  @Header('Cache-Control', 'no-store')
  async consultarVistaPrevia(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
  ) {
    const actorId = validarSolicitud(solicitud, reservaId);
    try {
      return await this.servicio.consultarVistaPrevia(reservaId, actorId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post()
  async confirmar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
    @Body() cuerpo: ConfirmacionCancelacion | undefined,
  ) {
    const actorId = validarSolicitud(solicitud, reservaId);
    if (!cuerpo?.vistaPrevia) {
      throw new BadRequestException('Confirma con una vista previa valida.');
    }

    try {
      return await this.servicio.confirmar(reservaId, actorId, cuerpo.motivo, cuerpo.vistaPrevia);
    } catch (error) {
      traducirError(error);
    }
  }
}

@Controller('trabajador/avisos')
export class AvisosCancelacionController {
  constructor(private readonly servicio: CancelacionClienteService) {}

  @Get('cancelaciones')
  @Header('Cache-Control', 'no-store')
  async consultar(@Req() solicitud: SolicitudAutenticada) {
    const trabajadorId = solicitud.user?.usuarioId;
    if (!esIdValido(trabajadorId)) {
      throw new UnauthorizedException('Inicia sesion para consultar tus avisos.');
    }

    return this.servicio.consultarAvisosDelTrabajador(trabajadorId);
  }
}
