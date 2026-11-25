import { Injectable } from '@nestjs/common';
import { CambiosSolicitud, EventoSolicitud, NuevaSolicitud, SolicitudPublicada, SolicitudesRepository } from '../CORE/solicitudes';
import { DbService } from './db.service';

@Injectable()
export class PostgresSolicitudesRepository implements SolicitudesRepository {
  constructor(private readonly db: DbService) {}

  async esCliente(usuarioId: string): Promise<boolean> {
    const { rows } = await this.db.pool.query(
      "SELECT 1 FROM arreglalo.usuario WHERE usuario_id = $1 AND estado = 'activo' AND arreglalo.tiene_rol($1, 'cliente')",
      [usuarioId],
    );
    return rows.length === 1;
  }

  async zonas() {
    const { rows } = await this.db.pool.query<{ id: string; nombre: string }>(
      'SELECT zona_id::text AS id, nombre FROM arreglalo.zona ORDER BY nombre',
    );
    return rows;
  }

  async listar(usuarioId: string) {
    const { rows } = await this.db.pool.query<SolicitudPublicada>(`
      SELECT s.solicitud_id::text AS id, s.descripcion, s.ubicacion_servicio AS ubicacion,
        s.zona_id::text AS "zonaId", s.urgente, s.creada_en AS "creadaEn", s.estado,
        json_agg(json_build_object('categoriaId', ss.categoria_id::text, 'descripcion', ss.descripcion)
                 ORDER BY ss.numero) AS servicios
      FROM arreglalo.solicitud s
      JOIN arreglalo.servicio_solicitado ss USING (solicitud_id)
      WHERE s.cliente_id = $1
      GROUP BY s.solicitud_id
      ORDER BY s.creada_en DESC, s.solicitud_id DESC
    `, [usuarioId]);
    return rows;
  }

  async modificar(usuarioId: string, solicitudId: string, cambios: CambiosSolicitud) {
    const conexion = await this.db.pool.connect();
    try {
      await conexion.query('BEGIN');
      const { rowCount } = await conexion.query(
        'SELECT 1 FROM arreglalo.solicitud WHERE solicitud_id = $1 AND cliente_id = $2 FOR UPDATE',
        [solicitudId, usuarioId],
      );
      if (!rowCount) {
        await conexion.query('ROLLBACK');
        return false;
      }
      const actualizada = await conexion.query(`
        UPDATE arreglalo.solicitud AS s SET descripcion = $3, ubicacion_servicio = $4
        WHERE s.solicitud_id = $1 AND s.cliente_id = $2 AND s.estado = 'publicada'
          AND NOT EXISTS (SELECT 1 FROM arreglalo.oferta o WHERE o.solicitud_id = s.solicitud_id)
      `, [solicitudId, usuarioId, cambios.descripcion, cambios.ubicacion]);
      await conexion.query('COMMIT');
      return actualizada.rowCount === 1;
    } catch (error) {
      await conexion.query('ROLLBACK');
      throw error;
    } finally {
      conexion.release();
    }
  }

  async historial(usuarioId: string, solicitudId: string) {
    const { rows } = await this.db.pool.query<EventoSolicitud>(`
      SELECT s.creada_en AS "registradaEn", 'publicada' AS estado, ARRAY[]::text[] AS campos
      FROM arreglalo.solicitud s WHERE s.solicitud_id = $1 AND s.cliente_id = $2
      UNION ALL
      SELECT h.registrada_en, h.estado, h.campos
      FROM arreglalo.historial_solicitud h JOIN arreglalo.solicitud s USING (solicitud_id)
      WHERE s.solicitud_id = $1 AND s.cliente_id = $2
      ORDER BY "registradaEn"
    `, [solicitudId, usuarioId]);
    return rows.length ? rows : null;
  }

  async publicar(usuarioId: string, datos: NuevaSolicitud) {
    const { rows } = await this.db.pool.query<{ id: string }>(`
      WITH nueva AS (
        INSERT INTO arreglalo.solicitud (cliente_id, descripcion, ubicacion_servicio, zona_id, urgente)
        VALUES ($1, $2, $3, $4, $5)
        RETURNING solicitud_id
      ), servicios AS (
        INSERT INTO arreglalo.servicio_solicitado (solicitud_id, numero, categoria_id, descripcion)
        SELECT nueva.solicitud_id, servicio.numero, (servicio.datos->>'categoriaId')::bigint,
          servicio.datos->>'descripcion'
        FROM nueva CROSS JOIN jsonb_array_elements($6::jsonb) WITH ORDINALITY AS servicio(datos, numero)
      )
      SELECT solicitud_id::text AS id FROM nueva
    `, [usuarioId, datos.descripcion, datos.ubicacion, datos.zonaId, datos.urgente, JSON.stringify(datos.servicios)]);
    return rows[0].id;
  }
}
