
import { Controller, Get, Post, Param, Req, Body, Header, UnauthorizedException, BadRequestException } from '@nestjs/common';
import { ModeracionOpinionesService } from '../SERVICE/moderacion-opiniones.service';

function idValido(id: unknown): string {
  if (typeof id !== 'string' || !/^[1-9][0-9]{0,18}$/.test(id) || BigInt(id)>9223372036854775807n) {
    throw new BadRequestException('Identificador inválido.');
  }
  return id;
}
function actor(req: {user?: {usuarioId?: unknown}}): string {
  if (!req.user?.usuarioId) throw new UnauthorizedException('Inicia sesión.');
  return idValido(req.user.usuarioId);
}

@Controller()
export class ModeracionOpinionesController {
  constructor(private readonly servicio: ModeracionOpinionesService) {}
  @Post('calificaciones/:id/reportes')
  reportar(@Req() req: any, @Param('id') id: string, @Body() body?: {motivo?: unknown}) {
    return this.servicio.reportar(actor(req),idValido(id),body?.motivo);
  }
  @Get('administracion/reportes-opiniones')
  @Header('Cache-Control','no-store')
  listar(@Req() req: any) { return this.servicio.listar(actor(req)); }
  @Post('administracion/reportes-opiniones/:id/revision')
  revisar(@Req() req: any, @Param('id') id: string) {
    return this.servicio.revisar(actor(req),idValido(id));
  }
  @Post('administracion/reportes-opiniones/:id/resolucion')
  resolver(@Req() req: any, @Param('id') id: string, @Body() body?: {decision?: unknown; fundamento?: unknown}) {
    if (body?.decision === undefined) throw new BadRequestException('Selecciona una decisión.');
    return this.servicio.revisar(actor(req),idValido(id),body.decision,body.fundamento);
  }
  @Get('trabajadores/:id/reputacion')
  reputacion(@Param('id') id: string) { return this.servicio.reputacion(idValido(id)); }
}
