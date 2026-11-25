import{
    Controller, 
    Get,
    Req,
    UnauthorizedException,
    Post,
    Body, Res, HttpCode, Put
}from '@nestjs/common';

import {UsuariosService} from '../SERVICE/usuarios.service';
import type { Request, Response } from 'express';
import { AutenticacionService } from '../SERVICE/usuarios/autenticacion.service';
import { DatosRegistro, PerfilUsuario } from '../CORE/usuarios/usuario';

interface SolicitudAutenticada{
    user?: {
        usuarioId?: string;
    };
}

@Controller('usuarios')
export class UsuariosController{
    constructor(
        private readonly usuariosService: UsuariosService,
        private readonly autenticacion: AutenticacionService
    ){}


@Post('sesion')
@HttpCode(200)
async iniciarSesion(@Req() req: Request, @Body() datos?: { identificadorAcceso: string; contrasena: string }) {
  if (!datos) throw new UnauthorizedException('Credenciales inválidas');
  const { usuarioId } = await this.autenticacion.iniciarSesion(datos.identificadorAcceso, datos.contrasena);
  await new Promise<void>((resolve, reject) => {
    req.session.regenerate(error => error ? reject(error) : resolve());
  });
  req.session.usuarioId = usuarioId;
  await new Promise<void>((resolve, reject) => {
    req.session.save(error => error ? reject(error) : resolve());
  });
  return { usuarioId };
}

@Post('sesion/cerrar')
@HttpCode(204)
async cerrarSesion(@Req() req: Request, @Res({ passthrough: true }) res: Response) {
  await new Promise<void>((resolve, reject) => {
    req.session.destroy(error => error ? reject(error) : resolve());
  });
  res.clearCookie('arreglalo.sid', { path: '/' });
}

@Get('perfil')
async consultarPerfil(
    @Req() solicitud: SolicitudAutenticada
){
    const usuarioId = solicitud.user?.usuarioId;

    if(!usuarioId || !/^[1-9]\d{0,18}$/.test(usuarioId) || BigInt(usuarioId) > 9223372036854775807n){
        throw new UnauthorizedException('No autorizado');
    }

   return await this.usuariosService.consultarPerfil(usuarioId);  

 }


@Put('perfil')
async actualizarPerfil(@Req() solicitud: SolicitudAutenticada, @Body() datos?: Partial<PerfilUsuario>) {
  const usuarioId = solicitud.user?.usuarioId;
  if (!usuarioId) throw new UnauthorizedException('No autorizado');
  return this.usuariosService.actualizarPerfil(usuarioId, datos);
}

@Post('registro')
async registrar(
  @Body() datos: DatosRegistro
) {
  return this.usuariosService.registrarUsuario(datos);
}


}
