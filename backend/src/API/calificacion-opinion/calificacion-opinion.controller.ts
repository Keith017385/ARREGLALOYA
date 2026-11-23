import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { CalificacionOpinionService } from '../../SERVICE/calificacion-opinion/calificacion-opinion.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string'
    && /^[1-9][0-9]{0,18}$/.test(valor)
    && BigInt(valor) <= 9223372036854775807n;
}

@Controller('reservas/:reservaId/calificaciones')
export class CalificacionOpinionController {
  constructor(private readonly servicio: CalificacionOpinionService) {}

  @Post()
  async registrar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
    @Body() cuerpo: { puntuacion?: unknown; opinion?: unknown } | undefined,
  ) {
    const actorId = solicitud.user?.usuarioId;
    if (!esIdValido(actorId)) {
      throw new UnauthorizedException('Inicia sesion para calificar el servicio.');
    }
    if (!esIdValido(reservaId)) {
      throw new BadRequestException('El identificador de reserva no es valido.');
    }

    try {
      return await this.servicio.registrar(
        reservaId,
        actorId,
        cuerpo?.puntuacion,
        cuerpo?.opinion,
      );
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      switch (error.message) {
        case 'No se encontro la reserva.':
          throw new NotFoundException(error.message);
        case 'Solo el cliente de la reserva puede calificar el servicio.':
          throw new ForbiddenException(error.message);
        case 'Solo se puede calificar un servicio finalizado.':
          throw new ConflictException(error.message);
        case 'La puntuacion debe ser un numero finito mayor o igual a cero.':
        case 'La opinion debe ser un texto.':
          throw new BadRequestException(error.message);
        default:
          throw error;
      }
    }
  }
}
