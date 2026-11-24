import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { SolicitudDisponible } from '../CORE/solicitud-disponible';
import { DbService } from './db.service';

@Injectable()
export class PostgresSolicitudDisponibleRepository {
  constructor(private readonly db: DbService) {}

  async listarDisponibles(trabajadorId: string): Promise<SolicitudDisponible[]> {
    const sql = `SELECT s.solicitud_id::text AS "solicitudId",
        s.creada_en::text AS "creadaEn",
        s.descripcion,
        s.presupuesto_aproximado::float AS "presupuestoAproximado",
        s.urgente,
        z.nombre AS zona,
        COALESCE(
          json_agg(
            json_build_object(
              'categoriaId', c.categoria_id::text,
              'categoria', c.nombre,
              'descripcion', ss.descripcion
            ) ORDER BY ss.numero
          ) FILTER (WHERE ss.solicitud_id IS NOT NULL),
          '[]'::json
        ) AS servicios
      FROM arreglalo.solicitud s
      JOIN arreglalo.trabajador t ON t.usuario_id = $1::bigint
      JOIN arreglalo.zona z ON z.zona_id = s.zona_id
      LEFT JOIN arreglalo.servicio_solicitado ss ON ss.solicitud_id = s.solicitud_id
      LEFT JOIN arreglalo.categoria c ON c.categoria_id = ss.categoria_id
      WHERE s.estado = 'publicada'
        AND s.zona_id = t.zona_id
        AND EXISTS (
          SELECT 1
          FROM arreglalo.servicio_solicitado x
          JOIN arreglalo.trabajador_categoria tc
            ON tc.categoria_id = x.categoria_id AND tc.trabajador_id = t.usuario_id
          WHERE x.solicitud_id = s.solicitud_id
        )
        AND NOT EXISTS (
          SELECT 1 FROM arreglalo.oferta o
          WHERE o.solicitud_id = s.solicitud_id
            AND o.trabajador_id = t.usuario_id
            AND o.estado IN ('presentada', 'seleccionada')
        )
      GROUP BY s.solicitud_id, s.creada_en, s.descripcion,
               s.presupuesto_aproximado, s.urgente, z.nombre
      ORDER BY s.urgente DESC, s.creada_en DESC`;
    try {
      const r = await this.db.pool.query<SolicitudDisponible>(sql, [trabajadorId]);
      return r.rows;
    } catch {
      throw new ServiceUnavailableException('No se pudieron consultar las solicitudes.');
    }
  }
}