import { Injectable, NotFoundException } from '@nestjs/common';
import {
  CategoriaTrabajador,
  DatosPerfil,
  PerfilTrabajador,
  PerfilTrabajadorRepository,
} from '../CORE/perfil-trabajador';

@Injectable()
export class PerfilTrabajadorService {
  constructor(private readonly repositorio: PerfilTrabajadorRepository) {}

  async obtenerPerfil(usuarioId: string): Promise<PerfilTrabajador> {
    const perfil = await this.repositorio.obtener(usuarioId);
    if (!perfil) throw new NotFoundException('Trabajador no encontrado.');
    return perfil;
  }

  async actualizarPerfil(usuarioId: string, datos: DatosPerfil): Promise<PerfilTrabajador> {
    const perfil = await this.repositorio.actualizar(usuarioId, datos);
    if (!perfil) throw new NotFoundException('Trabajador no encontrado.');
    return perfil;
  }

  async listarServicios(usuarioId: string): Promise<CategoriaTrabajador[]> {
    await this.obtenerPerfil(usuarioId);
    return this.repositorio.listarCategorias(usuarioId);
  }

  async agregarServicio(usuarioId: string, categoriaId: string): Promise<CategoriaTrabajador[]> {
    await this.obtenerPerfil(usuarioId);
    await this.repositorio.agregarCategoria(usuarioId, categoriaId);
    return this.repositorio.listarCategorias(usuarioId);
  }

  async quitarServicio(usuarioId: string, categoriaId: string): Promise<CategoriaTrabajador[]> {
    await this.obtenerPerfil(usuarioId);
    await this.repositorio.quitarCategoria(usuarioId, categoriaId);
    return this.repositorio.listarCategorias(usuarioId);
  }
}