import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  CuentaTrabajador,
  CuentaTrabajadorRepository,
  EstadoCuenta,
  ResultadoCambioCuenta,
} from '../CORE/cuenta-trabajador';
import { DbService } from './db.service';

@Injectable()
export class PostgresCuentaTrabajadorRepository extends CuentaTrabajadorRepository {
  constructor(private readonly db: DbService) { super(); }

  async obtener(usuarioId: string): Promise<CuentaTrabajador | null> {
    const sql = `SELECT u.usuario_id::text AS "usuarioId", u.estado,
        CASE WHEN u.estado = 'suspendido_voluntario' THEN s.inicio END AS "suspendidaDesde"
      FROM arreglalo.usuario u
      JOIN arreglalo.trabajador t ON t.usuario_id = u.usuario_id
      LEFT JOIN LATERAL (
        SELECT inicio
        FROM arreglalo.suspension_voluntaria
        WHERE usuario_id = u.usuario_id AND reactivada_en IS NULL AND eliminada_en IS NULL
        ORDER BY inicio DESC, suspension_id DESC
        LIMIT 1
      ) s ON true
      WHERE u.usuario_id = $1::bigint`;
    try {
      const r = await this.db.pool.query<CuentaTrabajador>(sql, [usuarioId]);
      return r.rows[0] ?? null;
    } catch {
      throw new ServiceUnavailableException('No se pudo consultar la cuenta.');
    }
  }

   suspender(usuarioId: string): Promise<ResultadoCambioCuenta> {
    return this.cambiarEstado(
      usuarioId,
      'activo',
      async cliente => {
        await cliente.query(
          'INSERT INTO arreglalo.suspension_voluntaria (usuario_id) VALUES ($1::bigint)',
          [usuarioId],
        );
        await cliente.query(
          `UPDATE arreglalo.usuario SET estado = 'suspendido_voluntario' WHERE usuario_id = $1::bigint`,
          [usuarioId],
        );
      },
      'No se pudo suspender la cuenta.',
      async cliente => {
        const r = await cliente.query(
          `SELECT 1
           FROM arreglalo.reserva r
           JOIN arreglalo.cotizacion c ON c.cotizacion_id = r.cotizacion_id
           JOIN arreglalo.visita v ON v.visita_id = c.visita_id
           JOIN arreglalo.oferta o ON o.oferta_id = v.oferta_id
           WHERE o.trabajador_id = $1::bigint
             AND r.estado IN ('pendiente_anticipo', 'reservada', 'en_ejecucion')
           LIMIT 1`,
          [usuarioId],
        );
        return (r.rowCount ?? 0) > 0;
      },
    );
  }

  reactivar(usuarioId: string): Promise<ResultadoCambioCuenta> {
    return this.cambiarEstado(
      usuarioId,
      'suspendido_voluntario',
      async cliente => {
        await cliente.query(
          `UPDATE arreglalo.suspension_voluntaria SET reactivada_en = clock_timestamp()
           WHERE usuario_id = $1::bigint AND reactivada_en IS NULL AND eliminada_en IS NULL`,
          [usuarioId],
        );
        await cliente.query(
          `UPDATE arreglalo.usuario SET estado = 'activo' WHERE usuario_id = $1::bigint`,
          [usuarioId],
        );
      },
      'No se pudo reactivar la cuenta.',
    );
  }

  // Ambos pasos (registro y cambio de estado) se guardan juntos o no se guarda ninguno.
  private async cambiarEstado(
    usuarioId: string,
    estadoRequerido: EstadoCuenta,
    pasos: (cliente: PoolClient) => Promise<void>,
    mensajeError: string,
    bloqueo?: (cliente: PoolClient) => Promise<boolean>,
  ): Promise<ResultadoCambioCuenta> {
    let cliente: PoolClient | undefined;
    try {
      cliente = await this.db.pool.connect();
      await cliente.query('BEGIN');
      const actual = await cliente.query<{ estado: string }>(
        `SELECT u.estado
         FROM arreglalo.usuario u
         JOIN arreglalo.trabajador t ON t.usuario_id = u.usuario_id
         WHERE u.usuario_id = $1::bigint
         FOR UPDATE OF u`,
        [usuarioId],
      );
      if (actual.rowCount === 0) {
        await cliente.query('ROLLBACK');
        return 'no_encontrado';
      }
      if (actual.rows[0].estado !== estadoRequerido) {
        await cliente.query('ROLLBACK');
        return 'estado_no_permitido';
      }
            if (bloqueo && (await bloqueo(cliente))) {
        await cliente.query('ROLLBACK');
        return 'con_reservas_vigentes';
      }
      await pasos(cliente);
      await cliente.query('COMMIT');
      return 'ok';
    } catch {
      if (cliente) {
        try { await cliente.query('ROLLBACK'); } catch { /* la conexión ya no responde */ }
      }
      throw new ServiceUnavailableException(mensajeError);
    } finally {
      if (cliente) { cliente.release(); }
    }
  }
}