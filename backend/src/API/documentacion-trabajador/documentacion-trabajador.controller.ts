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

interface CuerpoRevisionDocumento { resultado?: unknown; motivo?: unknown; }

import { DocumentacionTrabajadorService } from '../../SERVICE/documentacion-trabajador/documentacion-trabajador.service';

@Controller('administracion')
export class DocumentacionTrabajadorController {
  constructor(private readonly servicio: DocumentacionTrabajadorService) {}

  // CU-16: revisión de la documentación de trabajadores.
  @Get('documentacion-trabajadores')
  @Header('Cache-Control', 'no-store')
  async listarDocumentos(
    @Req() solicitud: SolicitudAutenticada,
    @Query('estado') estado?: string,
  ) {
    const actorId = obtenerActor(solicitud);
    try {
      return await this.servicio.listarDocumentos(actorId, estado);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post('documentacion-trabajadores/:documentoId/revision')
  async revisarDocumento(
    @Req() solicitud: SolicitudAutenticada,
    @Param('documentoId') documentoId: string,
    @Body() cuerpo: CuerpoRevisionDocumento | undefined,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(documentoId, 'documento');
    try {
      return await this.servicio.revisarDocumento(
        actorId, documentoId, cuerpo?.resultado, cuerpo?.motivo,
      );
    } catch (error) {
      traducirError(error);
    }
  }
}
