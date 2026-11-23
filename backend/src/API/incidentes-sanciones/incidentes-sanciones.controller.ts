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
import { IncidentesSancionesService } from '../../SERVICE/incidentes-sanciones/incidentes-sanciones.service';

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
    throw new UnauthorizedException('Inicia sesion para gestionar los incidentes.');
  }
  return actorId;
}

function validarId(valor: unknown, nombre: string): string {
  if (!esIdValido(valor)) {
    throw new BadRequestException(`El identificador de ${nombre} no es valido.`);
  }
  return valor;
}

function leerFecha(valor: unknown, nombre: string): Date {
  if (typeof valor !== 'string') {
    throw new BadRequestException(`Envia ${nombre} en formato ISO 8601 UTC.`);
  }

  const fecha = new Date(valor);
  if (!Number.isFinite(fecha.getTime()) || fecha.toISOString() !== valor) {
    throw new BadRequestException(`Envia ${nombre} en formato ISO 8601 UTC.`);
  }

  return fecha;
}

function traducirError(error: unknown): never {
  if (!(error instanceof Error)) {
    throw error;
  }

  switch (error.message) {
    case 'Se requiere un administrador activo.':
      throw new ForbiddenException(error.message);
    case 'No se encontro la reserva.':
    case 'No se encontro el incidente.':
      throw new NotFoundException(error.message);
    case 'El incidente ya esta confirmado.':
    case 'Confirma el incidente antes de registrar una sancion.':
    case 'El usuario no esta vinculado al incidente.':
      throw new ConflictException(error.message);
    case 'La descripcion del incidente es obligatoria.':
    case 'El motivo de la sancion es obligatorio.':
    case 'Las fechas de la sancion no son validas.':
    case 'El fin de la sancion debe ser posterior al inicio.':
      throw new BadRequestException(error.message);
    default:
      throw error;
  }
}

@Controller('administracion/incidentes')
export class IncidentesSancionesController {
  constructor(private readonly servicio: IncidentesSancionesService) {}

  @Post()
  async registrar(
    @Req() solicitud: SolicitudAutenticada,
    @Body() cuerpo: { reservaId?: unknown; descripcion?: unknown } | undefined,
  ) {
    const actorId = obtenerActor(solicitud);
    const reservaId = validarId(cuerpo?.reservaId, 'reserva');

    try {
      return await this.servicio.registrarIncidente(reservaId, actorId, cuerpo?.descripcion);
    } catch (error) {
      traducirError(error);
    }
  }

  @Get(':incidenteId')
  @Header('Cache-Control', 'no-store')
  async consultar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('incidenteId') incidenteId: string,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(incidenteId, 'incidente');

    try {
      return await this.servicio.consultarIncidente(incidenteId, actorId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post(':incidenteId/confirmacion')
  async confirmar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('incidenteId') incidenteId: string,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(incidenteId, 'incidente');

    try {
      return await this.servicio.confirmarIncidente(incidenteId, actorId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post(':incidenteId/sanciones')
  async sancionar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('incidenteId') incidenteId: string,
    @Body() cuerpo: {
      usuarioId?: unknown;
      motivo?: unknown;
      inicio?: unknown;
      fin?: unknown;
    } | undefined,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(incidenteId, 'incidente');
    const usuarioId = validarId(cuerpo?.usuarioId, 'usuario');
    const inicio = leerFecha(cuerpo?.inicio, 'el inicio');
    const fin = leerFecha(cuerpo?.fin, 'el fin');

    try {
      return await this.servicio.registrarSancion(
        incidenteId, usuarioId, actorId, cuerpo?.motivo, inicio, fin,
      );
    } catch (error) {
      traducirError(error);
    }
  }
}
