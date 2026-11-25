import { Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { SeleccionTrabajadorRepository, TrabajadorDisponible } from '../CORE/seleccion-trabajador';
import { DbService } from './db.service';

@Injectable()
export class PostgresSeleccionTrabajadorRepository implements SeleccionTrabajadorRepository {
  constructor(private readonly db: DbService) {}

  buscar(clienteId: string, solicitudId: string) {
    return this.buscarEn(this.db.pool, clienteId, solicitudId, null);
  }

  private async buscarEn(conexion: Pool | PoolClient, clienteId: string, solicitudId: string, trabajadorId: string | null) {
    const { rows } = await conexion.query<TrabajadorDisponible>(`
      SELECT t.usuario_id::text AS id, COALESCE(p.nombre, 'Trabajador #' || t.usuario_id) AS nombre,
        z.nombre AS zona, COALESCE(prom.opiniones, 0)::int AS opiniones,
        prom.puntuacion_promedio::text AS puntuacion,
        COALESCE(seleccion.trabajador_id = t.usuario_id, false) AS seleccionado
      FROM arreglalo.solicitud s
      JOIN arreglalo.zona z USING (zona_id)
      LEFT JOIN LATERAL (
        SELECT trabajador_id FROM arreglalo.seleccion_trabajador
        WHERE solicitud_id = s.solicitud_id ORDER BY seleccion_id DESC LIMIT 1
      ) seleccion ON true
      LEFT JOIN arreglalo.trabajador t ON t.zona_id = s.zona_id AND t.usuario_id <> $1
        AND s.estado = 'publicada' AND ($3::bigint IS NULL OR t.usuario_id = $3)
        AND arreglalo.tiene_rol(t.usuario_id, 'trabajador')
        AND NOT EXISTS (
          SELECT 1 FROM arreglalo.servicio_solicitado ss
          WHERE ss.solicitud_id = s.solicitud_id AND NOT EXISTS (
            SELECT 1 FROM arreglalo.trabajador_categoria tc
            WHERE tc.trabajador_id = t.usuario_id AND tc.categoria_id = ss.categoria_id
          )
        )
        AND 2 = (
          SELECT count(*) FROM (
            SELECT DISTINCT ON (tipo) documento_id
            FROM arreglalo.documento_verificacion
            WHERE trabajador_id = t.usuario_id AND tipo IN ('carnet', 'certificado')
            ORDER BY tipo, presentado_en DESC, documento_id DESC
          ) d
          JOIN LATERAL (
            SELECT resultado FROM arreglalo.revision_documento
            WHERE documento_id = d.documento_id ORDER BY revisado_en DESC, revision_id DESC LIMIT 1
          ) revision ON true
          WHERE revision.resultado = 'aprobado'
        )
      LEFT JOIN arreglalo.perfil_usuario p ON p.usuario_id = t.usuario_id
      LEFT JOIN arreglalo.v_promedio_trabajador prom ON prom.trabajador_id = t.usuario_id
      WHERE s.cliente_id = $1 AND s.solicitud_id = $2
      ORDER BY prom.puntuacion_promedio DESC NULLS LAST, p.nombre, t.usuario_id
    `, [clienteId, solicitudId, trabajadorId]);
    return rows.length ? rows.filter(row => row.id !== null) : null;
  }

  async seleccionar(clienteId: string, solicitudId: string, trabajadorId: string) {
    const conexion = await this.db.pool.connect();
    try {
      await conexion.query('BEGIN');
      const { rowCount } = await conexion.query(
        'SELECT 1 FROM arreglalo.solicitud WHERE solicitud_id = $1 AND cliente_id = $2 FOR UPDATE',
        [solicitudId, clienteId],
      );
      if (!rowCount) {
        await conexion.query('ROLLBACK');
        return 'no-encontrada' as const;
      }
      const candidatos = await this.buscarEn(conexion, clienteId, solicitudId, trabajadorId);
      const candidato = candidatos?.[0];
      if (!candidato) {
        await conexion.query('ROLLBACK');
        return 'no-disponible' as const;
      }
      if (!candidato.seleccionado) {
        await conexion.query(
          'INSERT INTO arreglalo.seleccion_trabajador (solicitud_id, trabajador_id) VALUES ($1, $2)',
          [solicitudId, trabajadorId],
        );
      }
      await conexion.query('COMMIT');
      return 'seleccionado' as const;
    } catch (error) {
      await conexion.query('ROLLBACK');
      throw error;
    } finally {
      conexion.release();
    }
  }
}
