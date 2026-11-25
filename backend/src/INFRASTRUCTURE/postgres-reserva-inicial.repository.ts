import { ConflictException, Injectable } from '@nestjs/common';
import type { Pool, PoolClient } from 'pg';
import { ReservaInicialRepository, ResumenReservaInicial } from '../CORE/reserva-inicial';
import { DbService } from './db.service';

@Injectable()
export class PostgresReservaInicialRepository implements ReservaInicialRepository {
  constructor(private readonly db: DbService) {}

  consultar(clienteId: string, cotizacionId: string) {
    return this.resumen(this.db.pool, clienteId, cotizacionId);
  }

  private async resumen(conexion: Pool | PoolClient, clienteId: string, cotizacionId: string) {
    const { rows: [fila] } = await conexion.query<ResumenReservaInicial>(`
      SELECT precio::text, round(precio * tasa_anticipo, 2)::text AS anticipo,
        round(round(precio * tasa_anticipo, 2) * tasa_comision, 2)::text AS comision,
        reserva_id::text AS "reservaId", estado
      FROM (
        SELECT round((c.mano_obra + c.materiales + c.transporte) *
          CASE WHEN s.urgente THEN 1 + rf.tasa_urgencia ELSE 1 END, 2) AS precio,
          rf.tasa_anticipo, rf.tasa_comision, r.reserva_id, r.estado
        FROM arreglalo.cotizacion c
        JOIN arreglalo.decision_cotizacion d USING (cotizacion_id)
        JOIN arreglalo.visita v USING (visita_id)
        JOIN arreglalo.oferta o USING (oferta_id)
        JOIN arreglalo.solicitud s USING (solicitud_id)
        JOIN arreglalo.regla_financiera rf USING (regla_id)
        LEFT JOIN arreglalo.reserva r USING (cotizacion_id)
        WHERE c.cotizacion_id = $1 AND s.cliente_id = $2 AND d.decision = 'aceptada'
          AND (r.reserva_id IS NOT NULL OR (s.estado = 'seleccionada' AND o.estado = 'seleccionada'
            AND arreglalo.tiene_rol(o.trabajador_id, 'trabajador')))
      ) AS aceptada
    `, [cotizacionId, clienteId]);
    return fila ?? null;
  }

  async crear(clienteId: string, cotizacionId: string, inicio: Date) {
    const conexion = await this.db.pool.connect();
    try {
      await conexion.query('BEGIN');
      await conexion.query('SELECT 1 FROM arreglalo.cotizacion WHERE cotizacion_id = $1 FOR UPDATE', [cotizacionId]);
      const resumen = await this.resumen(conexion, clienteId, cotizacionId);
      if (!resumen || resumen.reservaId) {
        await conexion.query('COMMIT');
        return resumen;
      }
      if (Number(resumen.anticipo) <= 0) throw new ConflictException('El precio no genera un anticipo válido.');
      const { rows: [reserva] } = await conexion.query<{ id: string }>(
        'SELECT arreglalo.crear_reserva($1, $2, $3)::text AS id', [clienteId, cotizacionId, inicio],
      );
      await conexion.query(`
        INSERT INTO arreglalo.solicitud_financiera (reserva_id, tipo, importe_solicitado, solicitante_id)
        VALUES ($1, 'anticipo', $2, $3)
      `, [reserva.id, resumen.anticipo, clienteId]);
      await conexion.query('COMMIT');
      return { ...resumen, reservaId: reserva.id, estado: 'pendiente_anticipo' };
    } catch (error) {
      await conexion.query('ROLLBACK');
      throw error;
    } finally {
      conexion.release();
    }
  }
}
