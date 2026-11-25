import {
    Injectable,
    UnauthorizedException
}from '@nestjs/common';

import { compare } from 'bcryptjs';

import { UsuariosRepository } from
  '../../CORE/usuarios/usuarios.repository';

@Injectable()
export class AutenticacionService{
    constructor(
        private readonly repository: UsuariosRepository
    ){}
 async iniciarSesion(
    identificador: string,
    password: string
 ): Promise<{ usuarioId: string }> {
    if( typeof identificador !== 'string' || 
        typeof password !== 'string' ||
         identificador.trim() === '' ||
        !password || Buffer.byteLength(password, 'utf8') > 72)
        {
        throw new UnauthorizedException('Credenciales inválidas');
    }
    const cuenta = await this.repository.buscarCuenta(identificador.trim().toLowerCase());

    if(!cuenta){
        throw new UnauthorizedException('Credenciales inválidas');
    }

    const esValido = await compare(password, cuenta.hashCredencial);

    if(!esValido){
        throw new UnauthorizedException('Credenciales inválidas');
    }

    
    const usuario =await this.repository.buscarUsuario(cuenta.usuarioId);

    if (!usuario || !['activo', 'suspendido_voluntario'].includes(usuario.estado)) {
        throw new UnauthorizedException('Credenciales inválidas');
    }

    return { usuarioId: usuario.usuarioId };
 }
}
