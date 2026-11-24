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

interface CuerpoResolucionReclamo { causal?: unknown; resolucion?: unknown; }
interface CuerpoVincularOperacion { solicitudFinancieraId?: unknown; }

import { GestionReclamosService } from '../../SERVICE/gestion-reclamos/gestion-reclamos.service';

@Controller('administracion')
export class GestionReclamosController {
  constructor(private readonly servicio: GestionReclamosService) {}

  // CU-17: consulta, revisión, vinculación de operaciones y resolución de reclamos.
  @Get('reclamos')
  @Header('Cache-Control', 'no-store')
  async listarReclamos(
    @Req() solicitud: SolicitudAutenticada,
    @Query('estado') estado?: string,
  ) {
    const actorId = obtenerActor(solicitud);
    try {
      return await this.servicio.listarReclamos(actorId, estado);
    } catch (error) {
      traducirError(error);
    }
  }

  @Get('reclamos/:reclamoId')
  @Header('Cache-Control', 'no-store')
  async consultarReclamo(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reclamoId') reclamoId: string,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reclamoId, 'reclamo');
    try {
      const resultado = await this.servicio.consultarReclamo(actorId, reclamoId);
      if (!resultado) throw new Error('No se encontró el reclamo.');
      return resultado;
    } catch (error) {
      traducirError(error);
    }
  }

  @Post('reclamos/:reclamoId/revision')
  async iniciarRevisionReclamo(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reclamoId') reclamoId: string,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reclamoId, 'reclamo');
    try {
      return await this.servicio.iniciarRevisionReclamo(actorId, reclamoId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post('reclamos/:reclamoId/operaciones')
  async vincularOperacion(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reclamoId') reclamoId: string,
    @Body() cuerpo: CuerpoVincularOperacion | undefined,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reclamoId, 'reclamo');
    const solicitudId = validarId(cuerpo?.solicitudFinancieraId, 'solicitud financiera');
    try {
      return await this.servicio.vincularOperacionReclamo(actorId, reclamoId, solicitudId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post('reclamos/:reclamoId/resolucion')
  async resolverReclamo(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reclamoId') reclamoId: string,
    @Body() cuerpo: CuerpoResolucionReclamo | undefined,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reclamoId, 'reclamo');
    try {
      return await this.servicio.resolverReclamo(
        actorId, reclamoId, cuerpo?.causal, cuerpo?.resolucion,
      );
    } catch (error) {
      traducirError(error);
    }
  }
}
