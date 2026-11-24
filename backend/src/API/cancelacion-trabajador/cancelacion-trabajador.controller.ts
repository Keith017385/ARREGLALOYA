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
import type { VistaPreviaCancelacionTrabajador } from '../../CORE/cancelacion-trabajador/cancelacion-trabajador.repository';
import { CancelacionTrabajadorService } from '../../SERVICE/cancelacion-trabajador/cancelacion-trabajador.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

interface CuerpoConfirmacion {
  motivo?: unknown;
  vistaPrevia?: VistaPreviaCancelacionTrabajador;
}

function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string'
    && /^[1-9][0-9]{0,18}$/.test(valor)
    && BigInt(valor) <= 9223372036854775807n;
}

function validarSolicitud(solicitud: SolicitudAutenticada, reservaId: string): string {
  const trabajadorId = solicitud.user?.usuarioId;
  if (!esIdValido(trabajadorId)) {
    throw new UnauthorizedException('Inicia sesion para gestionar la cancelacion.');
  }
  if (!esIdValido(reservaId)) {
    throw new BadRequestException('El identificador de reserva no es valido.');
  }
  return trabajadorId;
}

function traducirError(error: unknown): never {
  if (!(error instanceof Error)) {
    throw error;
  }

  switch (error.message) {
    case 'No se encontro la reserva.':
      throw new NotFoundException(error.message);
    case 'El usuario no corresponde al trabajador contratado.':
    case 'El usuario no tiene un rol de trabajador activo.':
      throw new ForbiddenException(error.message);
    case 'El motivo de cancelacion es obligatorio.':
    case 'Confirma con una vista previa valida.':
      throw new BadRequestException(error.message);
    case 'La reserva no esta disponible para cancelacion por el trabajador.':
    case 'Hay compromisos o movimientos abiertos que deben conciliarse antes de cancelar.':
    case 'La vista previa cambio. Consulta el resultado antes de confirmar.':
    case 'La liquidacion de la cancelacion no corresponde al trabajador.':
      throw new ConflictException(error.message);
    case 'Conciliar compromisos y ejecuciones abiertas antes de liquidar':
      throw new ConflictException(
        'Hay compromisos o movimientos abiertos que deben conciliarse antes de cancelar.',
      );
    case 'Contratación cerrada':
      throw new ConflictException('La reserva ya se encuentra cerrada.');
    case 'Cancelación de un usuario ajeno':
      throw new ForbiddenException('El usuario no corresponde al trabajador contratado.');
    default:
      throw error;
  }
}

@Controller('trabajador/reservas/:reservaId/cancelacion')
export class CancelacionTrabajadorController {
  constructor(private readonly servicio: CancelacionTrabajadorService) {}

  @Get('vista-previa')
  @Header('Cache-Control', 'no-store')
  async consultarVistaPrevia(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
  ) {
    const trabajadorId = validarSolicitud(solicitud, reservaId);
    try {
      return await this.servicio.consultarVistaPrevia(reservaId, trabajadorId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post()
  async confirmar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
    @Body() cuerpo: CuerpoConfirmacion | undefined,
  ) {
    const trabajadorId = validarSolicitud(solicitud, reservaId);
    if (!cuerpo?.vistaPrevia) {
      throw new BadRequestException('Confirma con una vista previa valida.');
    }

    try {
      return await this.servicio.confirmar(
        reservaId,
        trabajadorId,
        cuerpo.motivo,
        cuerpo.vistaPrevia,
      );
    } catch (error) {
      traducirError(error);
    }
  }
}
