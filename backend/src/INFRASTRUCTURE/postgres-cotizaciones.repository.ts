import { Injectable } from '@nestjs/common';
import { CotizacionesRepository, DecisionCotizacion, OfertaCotizacion } from '../CORE/cotizaciones';
import { DbService } from './db.service';

@Injectable()
export class PostgresCotizacionesRepository implements CotizacionesRepository {
  constructor(private readonly db: DbService) {}

  async listar(clienteId: string, solicitudId: string) {
    const { rows } = await this.db.pool.query<OfertaCotizacion>(`
      SELECT o.oferta_id::text AS "ofertaId", COALESCE(p.nombre, 'Trabajador #' || o.trabajador_id) AS trabajador,
        o.estado AS "estadoOferta", c.cotizacion_id::text AS "cotizacionId",
        round((c.mano_obra + c.materiales + c.transporte) *
          CASE WHEN s.urgente THEN 1 + rf.tasa_urgencia ELSE 1 END, 2)::text AS precio,
        c.vence_en AS "venceEn", d.decision,
        COALESCE(s.estado IN ('publicada', 'seleccionada') AND o.estado IN ('presentada', 'seleccionada')
          AND c.vence_en > clock_timestamp() AND d.decision IS NULL
          AND NOT EXISTS (
            SELECT 1 FROM arreglalo.decision_cotizacion d2
            JOIN arreglalo.cotizacion c2 USING (cotizacion_id)
            JOIN arreglalo.visita v2 USING (visita_id)
            JOIN arreglalo.oferta o2 USING (oferta_id)
            WHERE o2.solicitud_id = s.solicitud_id AND d2.decision = 'aceptada'
          ), false) AS disponible
      FROM arreglalo.solicitud s
      LEFT JOIN arreglalo.oferta o USING (solicitud_id)
      LEFT JOIN arreglalo.perfil_usuario p ON p.usuario_id = o.trabajador_id
      LEFT JOIN arreglalo.visita v USING (oferta_id)
      LEFT JOIN LATERAL (
        SELECT * FROM arreglalo.cotizacion WHERE visita_id = v.visita_id ORDER BY version DESC LIMIT 1
      ) c ON true
      LEFT JOIN arreglalo.regla_financiera rf USING (regla_id)
      LEFT JOIN arreglalo.decision_cotizacion d USING (cotizacion_id)
      WHERE s.solicitud_id = $1 AND s.cliente_id = $2
      ORDER BY o.oferta_id DESC, c.cotizacion_id DESC
    `, [solicitudId, clienteId]);
    return rows.length ? rows.filter(row => row.ofertaId !== null) : null;
  }

  async decidir(clienteId: string, solicitudId: string, cotizacionId: string, decision: DecisionCotizacion) {
    const conexion = await this.db.pool.connect();
    try {
      await conexion.query('BEGIN');
      const { rows: [solicitud] } = await conexion.query(
        'SELECT estado FROM arreglalo.solicitud WHERE solicitud_id = $1 AND cliente_id = $2 FOR UPDATE',
        [solicitudId, clienteId],
      );
      if (!solicitud) {
        await conexion.query('ROLLBACK');
        return 'no-encontrada' as const;
      }
      const { rows: [oferta] } = await conexion.query<{ id: string }>(`
        SELECT o.oferta_id::text AS id
        FROM arreglalo.cotizacion c
        JOIN arreglalo.visita v USING (visita_id)
        JOIN arreglalo.oferta o USING (oferta_id)
        JOIN arreglalo.usuario u ON u.usuario_id = o.trabajador_id
        WHERE c.cotizacion_id = $1 AND o.solicitud_id = $2
          AND o.estado IN ('presentada', 'seleccionada') AND u.estado = 'activo'
          AND c.vence_en > clock_timestamp()
          AND NOT EXISTS (SELECT 1 FROM arreglalo.cotizacion posterior
            WHERE posterior.visita_id = c.visita_id AND posterior.version > c.version)
          AND NOT EXISTS (SELECT 1 FROM arreglalo.decision_cotizacion WHERE cotizacion_id = c.cotizacion_id)
          AND NOT EXISTS (
            SELECT 1 FROM arreglalo.decision_cotizacion d
            JOIN arreglalo.cotizacion anterior USING (cotizacion_id)
            JOIN arreglalo.visita av USING (visita_id)
            JOIN arreglalo.oferta ao USING (oferta_id)
            WHERE ao.solicitud_id = o.solicitud_id AND d.decision = 'aceptada'
          )
        FOR UPDATE OF o
      `, [cotizacionId, solicitudId]);
      if (!oferta || !['publicada', 'seleccionada'].includes(solicitud.estado)) {
        await conexion.query('ROLLBACK');
        return 'no-disponible' as const;
      }
      await conexion.query(
        'INSERT INTO arreglalo.decision_cotizacion (cotizacion_id, actor_id, decision) VALUES ($1, $2, $3)',
        [cotizacionId, clienteId, decision],
      );
      if (decision === 'aceptada') {
        await conexion.query("UPDATE arreglalo.oferta SET estado = 'seleccionada' WHERE oferta_id = $1", [oferta.id]);
        await conexion.query("UPDATE arreglalo.solicitud SET estado = 'seleccionada' WHERE solicitud_id = $1", [solicitudId]);
      }
      await conexion.query('COMMIT');
      return 'registrada' as const;
    } catch (error) {
      await conexion.query('ROLLBACK');
      if (error instanceof Error && (error.message === 'Cotización vencida' || ('code' in error && error.code === '23505'))) {
        return 'no-disponible' as const;
      }
      throw error;
    } finally {
      conexion.release();
    }
  }
}
