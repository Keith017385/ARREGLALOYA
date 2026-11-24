import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  CategoriaTrabajador,
  DatosPerfil,
  PerfilTrabajador,
  PerfilTrabajadorRepository,
} from '../CORE/perfil-trabajador';
import { DbService } from './db.service';

@Injectable()
export class PostgresPerfilTrabajadorRepository extends PerfilTrabajadorRepository {
  constructor(private readonly db: DbService) { super(); }

  async obtener(usuarioId: string): Promise<PerfilTrabajador | null> {
    const sql = `SELECT t.usuario_id::text AS "usuarioId", p.nombre, p.telefono,
        p.correo_contacto AS "correoContacto", p.direccion, t.zona_id::text AS "zonaId"
      FROM arreglalo.trabajador t
      LEFT JOIN arreglalo.perfil_usuario p ON p.usuario_id = t.usuario_id
      WHERE t.usuario_id = $1::bigint`;
    try {
      const r = await this.db.pool.query<PerfilTrabajador>(sql, [usuarioId]);
      return r.rows[0] ?? null;
    } catch {
      throw new ServiceUnavailableException('No se pudo consultar el perfil.');
    }
  }

  async actualizar(usuarioId: string, datos: DatosPerfil): Promise<PerfilTrabajador | null> {
    const sql = `INSERT INTO arreglalo.perfil_usuario
        (usuario_id, nombre, telefono, correo_contacto, direccion)
      SELECT $1::bigint, $2::text, $3::text, $4::text, $5::text
      WHERE EXISTS (SELECT 1 FROM arreglalo.trabajador WHERE usuario_id = $1::bigint)
      ON CONFLICT (usuario_id) DO UPDATE
      SET nombre = EXCLUDED.nombre, telefono = EXCLUDED.telefono,
          correo_contacto = EXCLUDED.correo_contacto, direccion = EXCLUDED.direccion`;
    try {
      const r = await this.db.pool.query(sql, [
        usuarioId, datos.nombre, datos.telefono, datos.correoContacto, datos.direccion,
      ]);
      if (r.rowCount === 0) return null;
    } catch {
      throw new ServiceUnavailableException('No se pudo actualizar el perfil.');
    }
    return this.obtener(usuarioId);
  }

  async listarCategorias(usuarioId: string): Promise<CategoriaTrabajador[]> {
    const sql = `SELECT c.categoria_id::text AS id, c.codigo, c.nombre
      FROM arreglalo.trabajador_categoria tc
      JOIN arreglalo.categoria c ON c.categoria_id = tc.categoria_id
      WHERE tc.trabajador_id = $1::bigint
      ORDER BY c.nombre, c.categoria_id`;
    try {
      const r = await this.db.pool.query<CategoriaTrabajador>(sql, [usuarioId]);
      return r.rows;
    } catch {
      throw new ServiceUnavailableException('No se pudieron consultar los servicios.');
    }
  }

  async agregarCategoria(usuarioId: string, categoriaId: string): Promise<void> {
    const sql = `INSERT INTO arreglalo.trabajador_categoria (trabajador_id, categoria_id)
      VALUES ($1::bigint, $2::bigint)
      ON CONFLICT DO NOTHING`;
    try {
      await this.db.pool.query(sql, [usuarioId, categoriaId]);
    } catch {
      throw new ServiceUnavailableException('No se pudo agregar el servicio.');
    }
  }

  async quitarCategoria(usuarioId: string, categoriaId: string): Promise<void> {
    const sql = `DELETE FROM arreglalo.trabajador_categoria
      WHERE trabajador_id = $1::bigint AND categoria_id = $2::bigint`;
    try {
      await this.db.pool.query(sql, [usuarioId, categoriaId]);
    } catch {
      throw new ServiceUnavailableException('No se pudo quitar el servicio.');
    }
  }
}