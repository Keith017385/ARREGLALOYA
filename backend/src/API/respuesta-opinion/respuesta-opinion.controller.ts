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
import { RespuestaOpinionService } from '../../SERVICE/respuesta-opinion/respuesta-opinion.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string'
    && /^[1-9][0-9]{0,18}$/.test(valor)
    && BigInt(valor) <= 9223372036854775807n;
}

function validarSolicitud(solicitud: SolicitudAutenticada, calificacionId: string): string {
  const actorId = solicitud.user?.usuarioId;
  if (!esIdValido(actorId)) {
    throw new UnauthorizedException('Inicia sesion para consultar o responder la opinion.');
  }
  if (!esIdValido(calificacionId)) {
    throw new BadRequestException('El identificador de la calificacion no es valido.');
  }
  return actorId;
}

function traducirError(error: unknown): never {
  if (!(error instanceof Error)) throw error;

  switch (error.message) {
    case 'No se encontro la calificacion.':
      throw new NotFoundException(error.message);
    case 'Solo el trabajador contratado y activo puede responder la opinion.':
    case 'Solo el trabajador contratado puede responder la opinion.':
      throw new ForbiddenException(error.message);
    case 'La calificacion no tiene una opinion escrita para responder.':
    case 'La opinion o el permiso cambio antes de guardar la respuesta.':
      throw new ConflictException(error.message);
    case 'Escribe un texto valido para la respuesta.':
      throw new BadRequestException(error.message);
    default:
      throw error;
  }
}

@Controller('calificaciones/:calificacionId/opinion')
export class RespuestaOpinionController {
  constructor(private readonly servicio: RespuestaOpinionService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async consultar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('calificacionId') calificacionId: string,
  ) {
    const actorId = validarSolicitud(solicitud, calificacionId);
    try {
      return await this.servicio.consultarOpinion(calificacionId, actorId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post('respuestas')
  async responder(
    @Req() solicitud: SolicitudAutenticada,
    @Param('calificacionId') calificacionId: string,
    @Body() cuerpo: { texto?: unknown } | undefined,
  ) {
    const actorId = validarSolicitud(solicitud, calificacionId);
    try {
      return await this.servicio.responder(calificacionId, actorId, cuerpo?.texto);
    } catch (error) {
      traducirError(error);
    }
  }
}
