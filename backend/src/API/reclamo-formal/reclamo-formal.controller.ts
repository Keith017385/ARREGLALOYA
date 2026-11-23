import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ReclamoFormalService } from '../../SERVICE/reclamo-formal/reclamo-formal.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string'
    && /^[1-9][0-9]{0,18}$/.test(valor)
    && BigInt(valor) <= 9223372036854775807n;
}

function validarSolicitud(solicitud: SolicitudAutenticada, reservaId: string): string {
  const actorId = solicitud.user?.usuarioId;
  if (!esIdValido(actorId)) {
    throw new UnauthorizedException('Inicia sesion para gestionar tus reclamos.');
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
    case 'Solo el cliente de la reserva puede presentar un reclamo.':
      throw new ForbiddenException(error.message);
    case 'La descripcion del reclamo es obligatoria.':
      throw new BadRequestException(error.message);
    case 'La reserva no tiene una finalizacion registrada.':
    case 'El reclamo debe presentarse dentro del plazo de seis dias.':
      throw new ConflictException(error.message);
    default:
      throw error;
  }
}

@Controller('reservas/:reservaId/reclamos')
export class ReclamoFormalController {
  constructor(private readonly servicio: ReclamoFormalService) {}

  @Post()
  async presentar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
    @Body() cuerpo: { descripcion?: unknown } | undefined,
  ) {
    const actorId = validarSolicitud(solicitud, reservaId);

    try {
      return await this.servicio.presentar(reservaId, actorId, cuerpo?.descripcion);
    } catch (error) {
      traducirError(error);
    }
  }

  @Get()
  async consultar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
  ) {
    const actorId = validarSolicitud(solicitud, reservaId);

    try {
      return await this.servicio.consultar(reservaId, actorId);
    } catch (error) {
      traducirError(error);
    }
  }
}
