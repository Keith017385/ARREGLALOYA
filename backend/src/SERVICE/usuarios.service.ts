import {
    Injectable,
    NotFoundException,
    BadRequestException,
    ConflictException
} from '@nestjs/common';

import { UsuariosRepository } from '../CORE/usuarios/usuarios.repository';

import{hash} from 'bcryptjs';
import{DatosRegistro, PerfilUsuario} from '../CORE/usuarios/usuario';


  @Injectable()
  export class UsuariosService {
    constructor(
      private readonly usuariosRepository: UsuariosRepository
    ) {}
  

  async consultarPerfil(usuarioId: string){
    const usuario = await this.usuariosRepository.buscarUsuario(usuarioId);

    if(!usuario){
        throw new NotFoundException('Usuario no encontrado');
    }

    const perfil = await this.usuariosRepository.buscarPerfil(usuarioId);

    if(!perfil){
        throw new NotFoundException('Perfil no encontrado');
    }

    return {
        usuarioId: usuario.usuarioId,
        estado: usuario.estado,
        roles: await this.usuariosRepository.roles(usuarioId),
        nombre: perfil.nombre,
        telefono: perfil.telefono,
        correoContacto: perfil.correoContacto,
        direccion: perfil.direccion,
    }

  }

  async actualizarPerfil(usuarioId: string, datos?: Partial<PerfilUsuario>) {
    if (!datos || typeof datos.nombre !== 'string' || datos.nombre.trim().length < 2 || datos.nombre.trim().length > 100) {
      throw new BadRequestException('El nombre debe contener entre 2 y 100 caracteres.');
    }
    const opcional = (valor: unknown, maximo: number): string | null => {
      if (valor === null || valor === undefined || valor === '') return null;
      if (typeof valor !== 'string' || valor.trim().length > maximo) throw new BadRequestException('Dato de perfil inválido.');
      return valor.trim() || null;
    };
    const correoContacto = opcional(datos.correoContacto, 254);
    if (correoContacto && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoContacto)) {
      throw new BadRequestException('El correo de contacto no es válido.');
    }
    const cambios = {
      nombre: datos.nombre.trim(),
      telefono: opcional(datos.telefono, 30),
      direccion: opcional(datos.direccion, 500),
      correoContacto,
    };
    if (!await this.usuariosRepository.editarPerfil(usuarioId, cambios)) {
      throw new NotFoundException('Perfil activo no encontrado.');
    }
    return this.consultarPerfil(usuarioId);
  }

  listarZonasRegistro() {
    return this.usuariosRepository.zonasRegistro();
  }

async registrarUsuario(datos: DatosRegistro) {

  // 1. Comprobar los datos obligatorios.
  if (
    !datos ||
    typeof datos.nombre !== 'string' ||
    typeof datos.identificadorAcceso !== 'string' ||
    typeof datos.contrasena !== 'string'
  ) {
    throw new BadRequestException(
      'Debes completar los datos del registro'
    );
  }

  // 2. Limpiar los datos.
  const nombre = datos.nombre.trim();

  const identificadorAcceso =
    datos.identificadorAcceso.trim().toLowerCase();

  const rol = datos.rol === undefined ? 'cliente' : datos.rol;
  if (rol !== 'cliente' && rol !== 'trabajador') {
    throw new BadRequestException('Selecciona cliente o trabajador para crear la cuenta.');
  }
  let zonaId: string | undefined;
  if (rol === 'trabajador') {
    if (typeof datos.zonaId !== 'string' || !/^[1-9][0-9]{0,18}$/.test(datos.zonaId) || BigInt(datos.zonaId) > 9223372036854775807n) {
      throw new BadRequestException('Selecciona una zona de atención válida.');
    }
    const zonas = await this.usuariosRepository.zonasRegistro();
    if (!zonas.some(zona => zona.id === datos.zonaId)) {
      throw new BadRequestException('La zona seleccionada no está disponible.');
    }
    zonaId = datos.zonaId;
  }

  // 3. Validar los valores.
  if (
    nombre.length < 2 ||
    nombre.length > 100 ||
    !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(identificadorAcceso) ||
    Buffer.byteLength(datos.contrasena, 'utf8') < 8 ||
    Buffer.byteLength(datos.contrasena, 'utf8') > 72
  ) {
    throw new BadRequestException(
      'Nombre, correo o contraseña inválidos'
    );
  }

  // 4. Proteger la contraseña.
  const hashCredencial = await hash(
    datos.contrasena,
    12
  );

  // 5. Pedir a INFRASTRUCTURE que registre la cuenta.
  try {
    const usuario = await this.usuariosRepository.registrarCuenta({
      nombre,
      identificadorAcceso,
      hashCredencial,
      rol,
      zonaId,
    });

    return {
      mensaje: 'Cuenta registrada correctamente',
      usuarioId: usuario.usuarioId
    };

  } catch (error) {

    // PostgreSQL: error de valor duplicado.
    if (
      typeof error === 'object' &&
      error !== null &&
      'code' in error &&
      error.code === '23505'
    ) {
      throw new ConflictException(
        'Ya existe una cuenta con esos datos'
      );
    }

    if (
      rol === 'trabajador' && typeof error === 'object' && error !== null &&
      'code' in error && error.code === '23503'
    ) {
      throw new BadRequestException('La zona seleccionada ya no está disponible.');
    }

    throw error;
  }
}

}
