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
import { DeclaracionAsistenciaService } from '../../SERVICE/declaracion-asistencia/declaracion-asistencia.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string'
    && /^[1-9][0-9]{0,18}$/.test(valor)
    && BigInt(valor) <= 9223372036854775807n;
}

function obtenerActor(solicitud: SolicitudAutenticada): string {
  const actorId = solicitud.user?.usuarioId;
  if (!esIdValido(actorId)) {
    throw new UnauthorizedException('Inicia sesion para gestionar la asistencia.');
  }
  return actorId;
}

function validarId(id: string, nombre: string): void {
  if (!esIdValido(id)) {
    throw new BadRequestException(`El identificador de ${nombre} no es valido.`);
  }
}

function traducirError(error: unknown): never {
  if (!(error instanceof Error)) {
    throw error;
  }

  switch (error.message) {
    case 'No se encontro la reserva.':
    case 'No se encontro la declaracion en esta reserva.':
      throw new NotFoundException(error.message);
    case 'Solo el cliente de la reserva puede responder la declaracion.':
      throw new ForbiddenException(error.message);
    case 'La declaracion ya tiene una respuesta registrada.':
      throw new ConflictException(error.message);
    case 'La respuesta debe ser confirmada o rechazada.':
      throw new BadRequestException(error.message);
    default:
      throw error;
  }
}

@Controller('reservas/:reservaId/asistencias')
export class DeclaracionAsistenciaController {
  constructor(private readonly servicio: DeclaracionAsistenciaService) {}

  @Get()
  async consultar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reservaId, 'reserva');

    try {
      return await this.servicio.consultar(reservaId, actorId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post(':asistenciaId/respuesta')
  async responder(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
    @Param('asistenciaId') asistenciaId: string,
    @Body() cuerpo: { respuesta?: unknown } | undefined,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reservaId, 'reserva');
    validarId(asistenciaId, 'asistencia');

    try {
      return await this.servicio.responder(reservaId, asistenciaId, actorId, cuerpo?.respuesta);
    } catch (error) {
      traducirError(error);
    }
  }
}

@Controller('administracion/asistencias')
export class RevisionAsistenciaController {
  constructor(private readonly servicio: DeclaracionAsistenciaService) {}

  @Get('rechazadas')
  async consultarRechazadas(@Req() solicitud: SolicitudAutenticada) {
    const actorId = obtenerActor(solicitud);
    const rechazos = await this.servicio.consultarRechazadas(actorId);

    if (rechazos === null) {
      throw new ForbiddenException('Se requiere un administrador activo.');
    }

    return rechazos;
  }
}
