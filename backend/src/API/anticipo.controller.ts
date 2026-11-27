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
  Res,
  UnauthorizedException,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import type { Response } from 'express';
import { AnticipoService } from '../SERVICE/anticipo.service';

interface SolicitudAutenticada { user?: { usuarioId?: unknown }; }
interface ArchivoSubido { originalname: string; mimetype: string; buffer: Buffer; }

const MAX_BIGINT_POSTGRES = 9223372036854775807n;
function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[1-9][0-9]{0,18}$/.test(valor)
    && BigInt(valor) <= MAX_BIGINT_POSTGRES;
}
function obtenerActor(solicitud: SolicitudAutenticada): string {
  const id = solicitud.user?.usuarioId;
  if (!esIdValido(id)) throw new UnauthorizedException('Inicia sesión para continuar.');
  return id;
}
function validarId(valor: unknown, nombre: string): string {
  if (!esIdValido(valor)) throw new BadRequestException(`El identificador de ${nombre} no es válido.`);
  return valor;
}
function validarComprobante(archivo?: ArchivoSubido) {
  if (!archivo) return undefined;
  if (archivo.buffer.length < 5) {
    throw new BadRequestException('El comprobante está vacío o incompleto.');
  }
  const pdf = archivo.mimetype === 'application/pdf'
    && archivo.buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const png = archivo.mimetype === 'image/png'
    && archivo.buffer.subarray(0, 8).equals(Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]));
  const jpeg = archivo.mimetype === 'image/jpeg'
    && archivo.buffer[0] === 0xff && archivo.buffer[1] === 0xd8 && archivo.buffer[2] === 0xff;
  if (!pdf && !png && !jpeg) {
    throw new BadRequestException('El comprobante debe ser un PDF, PNG o JPG válido.');
  }
  return {
    nombre: archivo.originalname.replace(/[\r\n\\/]/g, '_').slice(0, 180),
    mime: archivo.mimetype as 'application/pdf' | 'image/png' | 'image/jpeg',
    contenido: archivo.buffer,
  };
}
function traducirError(error: unknown): never {
  if (!(error instanceof Error)) throw error;
  const mensaje = error.message;
  if (mensaje === 'Se requiere un administrador activo.' || mensaje.includes('Solo el cliente')) {
    throw new ForbiddenException(mensaje);
  }
  if (mensaje.startsWith('No se encontró')) throw new NotFoundException(mensaje);
  if (mensaje.includes('ya existe') || mensaje.includes('Ya existe') || mensaje.includes('ya fue')
      || mensaje.includes('ya no') || mensaje.includes('cambió') || mensaje.includes('Actualiza')) {
    throw new ConflictException(mensaje);
  }
  if (mensaje.includes('debe') || mensaje.includes('válid') || mensaje.includes('Selecciona')
      || mensaje.includes('Escribe') || mensaje.includes('no puede') || mensaje.includes('todavía no configuró')) {
    throw new BadRequestException(mensaje);
  }
  throw error;
}

@Controller()
export class AnticipoController {
  constructor(private readonly servicio: AnticipoService) {}

  @Get('reservas/:reservaId/anticipo')
  @Header('Cache-Control', 'no-store')
  async consultar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reservaId, 'reserva');
    try { return await this.servicio.consultar(reservaId, actorId); }
    catch (error) { traducirError(error); }
  }

  @Get('cliente/anticipos')
  @Header('Cache-Control', 'no-store')
  async listarPropias(@Req() solicitud: SolicitudAutenticada) {
    try { return await this.servicio.listarPropias(obtenerActor(solicitud)); }
    catch (error) { traducirError(error); }
  }

  @Post('reservas/:reservaId/anticipo/declaraciones')
  @UseInterceptors(FileInterceptor('comprobante', { limits: { fileSize: 5 * 1024 * 1024 } }))
  async declarar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
    @Body() cuerpo: { referencia?: unknown; fechaTransferencia?: unknown } | undefined,
    @UploadedFile() archivo?: ArchivoSubido,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reservaId, 'reserva');
    try {
      return await this.servicio.declarar(reservaId, actorId, {
        referencia: cuerpo?.referencia,
        fechaTransferencia: cuerpo?.fechaTransferencia,
        comprobante: validarComprobante(archivo),
      });
    } catch (error) { traducirError(error); }
  }

  @Get('administracion/anticipos-pendientes')
  @Header('Cache-Control', 'no-store')
  async listarPendientes(@Req() solicitud: SolicitudAutenticada) {
    try { return await this.servicio.listarPendientes(obtenerActor(solicitud)); }
    catch (error) { traducirError(error); }
  }

  @Get('administracion/anticipos/:declaracionId/comprobante')
  async descargarComprobante(
    @Req() solicitud: SolicitudAutenticada,
    @Param('declaracionId') declaracionId: string,
    @Res() respuesta: Response,
  ) {
    validarId(declaracionId, 'declaración');
    try {
      const comprobante = await this.servicio.obtenerComprobante(obtenerActor(solicitud), declaracionId);
      if (!comprobante) throw new NotFoundException('No se encontró el comprobante de esta declaración.');
      respuesta.setHeader('Content-Type', comprobante.mime);
      respuesta.setHeader('Content-Disposition', `inline; filename="${encodeURIComponent(comprobante.nombre)}"`);
      respuesta.setHeader('X-Content-Type-Options', 'nosniff');
      respuesta.setHeader('Content-Security-Policy', 'sandbox');
      respuesta.send(comprobante.contenido);
    } catch (error) { traducirError(error); }
  }

  @Post('administracion/anticipos/:declaracionId/resolucion')
  async resolver(
    @Req() solicitud: SolicitudAutenticada,
    @Param('declaracionId') declaracionId: string,
    @Body() cuerpo: { decision?: unknown; motivo?: unknown } | undefined,
  ) {
    validarId(declaracionId, 'declaración');
    try {
      return await this.servicio.resolver(
        obtenerActor(solicitud), declaracionId, cuerpo?.decision, cuerpo?.motivo,
      );
    } catch (error) { traducirError(error); }
  }
}
