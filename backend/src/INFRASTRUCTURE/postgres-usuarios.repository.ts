
import { Injectable } from '@nestjs/common';

import { DbService } from './db.service';

import { UsuariosRepository } from
  '../CORE/usuarios/usuarios.repository';

import {
  Usuario,
  PerfilUsuario,
  CuentaAcceso,
  RolUsuario,
  NuevaCuenta
} from '../CORE/usuarios/usuario';

@Injectable()
export class PostgresUsuariosRepository
  extends UsuariosRepository {

  constructor(private readonly db: DbService) {
    super();
  }

  async zonasRegistro(): Promise<{ id: string; nombre: string }[]> {
    const { rows } = await this.db.pool.query<{ id: string; nombre: string }>(`
      SELECT zona_id::text AS id, nombre FROM arreglalo.zona ORDER BY nombre
    `);
    return rows;
  }

  async roles(usuarioId: string): Promise<RolUsuario[]> {
    const { rows } = await this.db.pool.query<{ codigo: RolUsuario }>(`
      SELECT r.codigo FROM arreglalo.usuario_rol ur
      JOIN arreglalo.rol r USING (rol_id) WHERE ur.usuario_id = $1 ORDER BY r.codigo
    `, [usuarioId]);
    return rows.map(rol => rol.codigo);
  }

  async editarPerfil(usuarioId: string, cambios: Omit<PerfilUsuario, 'usuarioId'>): Promise<boolean> {
    const { rowCount } = await this.db.pool.query(`
      UPDATE arreglalo.perfil_usuario p SET nombre = $2, telefono = $3, correo_contacto = $4, direccion = $5
      WHERE p.usuario_id = $1 AND EXISTS (
        SELECT 1 FROM arreglalo.usuario u WHERE u.usuario_id = p.usuario_id AND u.estado = 'activo'
      )
    `, [usuarioId, cambios.nombre, cambios.telefono, cambios.correoContacto, cambios.direccion]);
    return rowCount === 1;
  }

  // 1. Buscar una cuenta para iniciar sesión.
  async buscarCuenta(
    identificador: string
  ): Promise<CuentaAcceso | null> {

    const resultado = await this.db.pool.query<CuentaAcceso>(
      `
      SELECT
        usuario_id::text AS "usuarioId",
        identificador_acceso AS "identificadorAcceso",
        hash_credencial AS "hashCredencial"
      FROM arreglalo.cuenta_acceso
      WHERE identificador_acceso = $1
      LIMIT 1
      `,
      [identificador.trim().toLowerCase()]
    );

    return resultado.rows[0] ?? null;
  }

  // 2. Buscar la identidad de un usuario.
  async buscarUsuario(
    usuarioId: string
  ): Promise<Usuario | null> {

    const resultado = await this.db.pool.query<Usuario>(
      `
      SELECT
        usuario_id::text AS "usuarioId",
        creado_en AS "creadoEn",
        estado
      FROM arreglalo.usuario
      WHERE usuario_id = $1::bigint
      `,
      [usuarioId]
    );

    return resultado.rows[0] ?? null;
  }

  // 3. Buscar los datos personales.
  async buscarPerfil(
    usuarioId: string
  ): Promise<PerfilUsuario | null> {

    const resultado = await this.db.pool.query<PerfilUsuario>(
      `
      SELECT
        usuario_id::text AS "usuarioId",
        nombre,
        telefono,
        correo_contacto AS "correoContacto",
        direccion
      FROM arreglalo.perfil_usuario
      WHERE usuario_id = $1::bigint
      `,
      [usuarioId]
    );

    return resultado.rows[0] ?? null;
  }


async registrarCuenta(datos: NuevaCuenta): Promise<Usuario> {

  // Obtenemos una conexión del Pool compartido.
  const cliente = await this.db.pool.connect();

  try {
    // Iniciamos la transacción.
    await cliente.query('BEGIN');

    // 1. Crear la identidad del usuario.
    const resultado = await cliente.query<Usuario>(
      `
      INSERT INTO arreglalo.usuario (creado_en, estado)
      VALUES (NOW(), $1)
      RETURNING
        usuario_id::text AS "usuarioId",
        creado_en AS "creadoEn",
        estado
      `,
      ['activo']
    );

    const usuario = resultado.rows[0];

    if (!usuario) {
      throw new Error('No se pudo crear el usuario');
    }

    // 2. Guardar los datos para iniciar sesión.
    await cliente.query(
      `
      INSERT INTO arreglalo.cuenta_acceso
        (usuario_id, identificador_acceso, hash_credencial)
      VALUES ($1, $2, $3)
      `,
      [
        usuario.usuarioId,
        datos.identificadorAcceso,
        datos.hashCredencial
      ]
    );

    // 3. Guardar la información personal.
    await cliente.query(
      `
      INSERT INTO arreglalo.perfil_usuario
        (usuario_id, nombre)
      VALUES ($1, $2)
      `,
      [usuario.usuarioId, datos.nombre]
    );

    // 4. Asignar inicialmente el rol cliente.
    const asignacion = await cliente.query(
      `
      INSERT INTO arreglalo.usuario_rol
        (usuario_id, rol_id)
      SELECT $1, rol_id
      FROM arreglalo.rol
      WHERE codigo = $2
      `,
      [usuario.usuarioId, datos.rol]
    );

    if (asignacion.rowCount !== 1) {
      throw new Error('No existe el rol solicitado');
    }

    if (datos.rol === 'trabajador') {
      await cliente.query(
        `INSERT INTO arreglalo.trabajador (usuario_id, zona_id) VALUES ($1, $2)`,
        [usuario.usuarioId, datos.zonaId],
      );
    }

    // Confirmamos todos los cambios.
    await cliente.query('COMMIT');

    return usuario;

  } catch (error) {

    // Si algo falla, deshacemos los cambios.
    await cliente.query('ROLLBACK');
    throw error;

  } finally {

    // Devolvemos la conexión al Pool.
    cliente.release();
  }
}

}
