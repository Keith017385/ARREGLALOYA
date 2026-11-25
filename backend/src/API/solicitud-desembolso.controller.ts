import {
  BadRequestException, Body, Controller, Get, Header, NotFoundException, Param, Post, Req, StreamableFile,
  UnauthorizedException, UploadedFile, UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { SolicitudDesembolsoRepository } from '../CORE/solicitud-desembolso';

interface SolicitudAutenticada { user?: { usuarioId: string }; }

function actor(req: SolicitudAutenticada) {
  if (!req.user) throw new UnauthorizedException('Inicia sesión para continuar.');
  return req.user.usuarioId;
}

function validarId(id: string) {
  if (!/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id) > 9223372036854775807n) {
    throw new BadRequestException('Identificador inválido.');
  }
}

@Controller()
export class SolicitudDesembolsoController {
  constructor(private readonly repo: SolicitudDesembolsoRepository) {}

  @Get('trabajador/desembolsos/reservas')
  listar(@Req() req: SolicitudAutenticada) {
    return this.repo.listar(actor(req));
  }

  @Post('trabajador/desembolsos/reservas/:id')
  @UseInterceptors(FileInterceptor('documento', { limits: { fileSize: 5 * 1024 * 1024, files: 1, fields: 1 } }))
  async solicitar(@Req() req: SolicitudAutenticada, @Param('id') id: string, @Body('importe') importe: unknown,
    @UploadedFile() archivo?: { buffer: Buffer }) {
    const trabajador = actor(req);
    validarId(id);
    if (typeof importe !== 'string' || !/^\d{1,12}(?:\.\d{1,2})?$/.test(importe) || Number(importe) <= 0) {
      throw new BadRequestException('Ingresa un importe positivo con hasta dos decimales.');
    }
    if (!archivo || archivo.buffer.subarray(0, 5).toString('ascii') !== '%PDF-') {
      throw new BadRequestException('Adjunta un documento PDF de hasta 5 MB.');
    }
    const solicitudId = await this.repo.solicitar(trabajador, id, importe, archivo.buffer);
    if (!solicitudId) throw new NotFoundException('Reserva no encontrada.');
    return { solicitudId, estado: 'pendiente' };
  }

  @Get('administracion/desembolsos/:id/documento')
  @Header('Cache-Control', 'no-store')
  @Header('X-Content-Type-Options', 'nosniff')
  async descargar(@Req() req: SolicitudAutenticada, @Param('id') id: string) {
    const administrador = actor(req);
    validarId(id);
    const archivo = await this.repo.documento(administrador, id);
    if (!archivo) throw new NotFoundException('No se encontró un documento para esta solicitud.');
    return new StreamableFile(archivo, { type: 'application/octet-stream', disposition: 'attachment; filename="respaldo.pdf"' });
  }
}
