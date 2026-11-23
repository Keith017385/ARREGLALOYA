import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Post,
  Put,
} from '@nestjs/common';
import { DatosPerfil } from '../CORE/perfil-trabajador';
import { PerfilTrabajadorService } from '../SERVICE/perfil-trabajador.service';

// Un id válido son solo dígitos (bigint de PostgreSQL, máximo 19).
function validarId(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^\d{1,19}$/.test(valor)) {
    throw new BadRequestException(`${campo} no es válido.`);
  }
  return valor;
}

// Texto opcional: vacío o ausente se guarda como null.
function textoOpcional(valor: unknown, campo: string, max: number): string | null {
  if (valor === undefined || valor === null) return null;
  if (typeof valor !== 'string') throw new BadRequestException(`${campo} no es válido.`);
  const limpio = valor.trim();
  if (limpio === '') return null;
  if (limpio.length > max) throw new BadRequestException(`${campo} es demasiado largo.`);
  return limpio;
}

function validarDatosPerfil(body: unknown): DatosPerfil {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Datos del perfil no válidos.');
  }
  const b = body as Record<string, unknown>;

  if (typeof b.nombre !== 'string' || b.nombre.trim() === '') {
    throw new BadRequestException('El nombre es obligatorio.');
  }
  const nombre = b.nombre.trim();
  if (nombre.length > 100) throw new BadRequestException('El nombre es demasiado largo.');

  const telefono = textoOpcional(b.telefono, 'El teléfono', 20);
  if (telefono !== null && !/^[0-9+\-\s()]{6,20}$/.test(telefono)) {
    throw new BadRequestException('El teléfono no es válido.');
  }

  const correoContacto = textoOpcional(b.correoContacto, 'El correo', 150);
  if (correoContacto !== null && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(correoContacto)) {
    throw new BadRequestException('El correo no es válido.');
  }

  const direccion = textoOpcional(b.direccion, 'La dirección', 200);

  return { nombre, telefono, correoContacto, direccion };
}

@Controller('trabajadores')
export class PerfilTrabajadorController {
  constructor(private readonly servicio: PerfilTrabajadorService) {}

  @Get(':usuarioId/perfil')
  obtenerPerfil(@Param('usuarioId') usuarioId: string) {
    return this.servicio.obtenerPerfil(validarId(usuarioId, 'El trabajador'));
  }

  @Put(':usuarioId/perfil')
  actualizarPerfil(@Param('usuarioId') usuarioId: string, @Body() body: unknown) {
    return this.servicio.actualizarPerfil(
      validarId(usuarioId, 'El trabajador'),
      validarDatosPerfil(body),
    );
  }

  @Get(':usuarioId/servicios')
  listarServicios(@Param('usuarioId') usuarioId: string) {
    return this.servicio.listarServicios(validarId(usuarioId, 'El trabajador'));
  }

  @Post(':usuarioId/servicios')
  agregarServicio(@Param('usuarioId') usuarioId: string, @Body() body: unknown) {
    const categoriaId = (body as { categoriaId?: unknown } | null)?.categoriaId;
    return this.servicio.agregarServicio(
      validarId(usuarioId, 'El trabajador'),
      validarId(categoriaId, 'La categoría'),
    );
  }

  @Delete(':usuarioId/servicios/:categoriaId')
  quitarServicio(
    @Param('usuarioId') usuarioId: string,
    @Param('categoriaId') categoriaId: string,
  ) {
    return this.servicio.quitarServicio(
      validarId(usuarioId, 'El trabajador'),
      validarId(categoriaId, 'La categoría'),
    );
  }
}