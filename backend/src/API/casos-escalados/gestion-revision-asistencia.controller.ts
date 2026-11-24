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
import { GestionRevisionAsistenciaService } from '../../SERVICE/casos-escalados/gestion-revision-asistencia.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string'
    && /^[1-9][0-9]{0,18}$/.test(valor)
    && BigInt(valor) <= 9223372036854775807n;
}

function validarSolicitud(solicitud: SolicitudAutenticada, respuestaId?: string): string {
  const actorId = solicitud.user?.usuarioId;
  if (!esIdValido(actorId)) {
    throw new UnauthorizedException('Inicia sesion para gestionar las revisiones de asistencia.');
  }
  if (respuestaId !== undefined && !esIdValido(respuestaId)) {
    throw new BadRequestException('El identificador de la respuesta no es valido.');
  }
  return actorId;
}

function traducirError(error: unknown): never {
  if (!(error instanceof Error)) {
    throw error;
  }

  switch (error.message) {
    case 'Se requiere un superadministrador activo.':
      throw new ForbiddenException(error.message);
    case 'No se encontro una revision registrada para esta respuesta.':
      throw new NotFoundException(error.message);
    case 'La resolucion debe contener entre 1 y 2000 caracteres validos.':
      throw new BadRequestException(error.message);
    case 'Solo una asistencia rechazada puede pasar a revision.':
    case 'La revision ya fue resuelta.':
    case 'La revision ya fue escalada.':
    case 'La revision aun no fue escalada.':
    case 'El plazo de revision administrativa aun no vencio.':
    case 'La revision o el permiso cambio antes de guardar.':
      throw new ConflictException(error.message);
    default:
      throw error;
  }
}

@Controller('superadministracion/revisiones-asistencia')
export class GestionRevisionAsistenciaController {
  constructor(private readonly servicio: GestionRevisionAsistenciaService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async listar(@Req() solicitud: SolicitudAutenticada) {
    const actorId = validarSolicitud(solicitud);
    try {
      return await this.servicio.listarAbiertas(actorId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post(':respuestaId/escalamiento')
  async escalar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('respuestaId') respuestaId: string,
  ) {
    const actorId = validarSolicitud(solicitud, respuestaId);
    try {
      return await this.servicio.escalar(respuestaId, actorId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post(':respuestaId/resolucion')
  async resolver(
    @Req() solicitud: SolicitudAutenticada,
    @Param('respuestaId') respuestaId: string,
    @Body() cuerpo: { resolucion?: unknown } | undefined,
  ) {
    const actorId = validarSolicitud(solicitud, respuestaId);
    try {
      return await this.servicio.resolver(respuestaId, actorId, cuerpo?.resolucion);
    } catch (error) {
      traducirError(error);
    }
  }
}
