import { Injectable, Logger, ServiceUnavailableException } from '@nestjs/common';
import { PoolClient } from 'pg';
import {
  CasoAbierto,
  DatosDictamen,
  DictamenAsistenciaRepository,
  ResultadoDictamen,
} from '../CORE/dictamen-asistencia';
import { DbService } from './db.service';

@Injectable()
export class PostgresDictamenAsistenciaRepository extends DictamenAsistenciaRepository {
  private readonly log = new Logger('DictamenAsistencia');
  constructor(private readonly db: DbService) { super(); }

  async listarAbiertos(): Promise<CasoAbierto[]> {
    const sql = `SELECT g.respuesta_asistencia_id::text AS "respuestaId",
        da.reserva_id::text AS "reservaId", r.estado AS "estadoReserva",
        ra.respondida_en::text AS "respondidaEn", g.escalada_en::text AS "escaladaEn"
      FROM arreglalo.gestion_revision_asistencia g
      JOIN arreglalo.respuesta_asistencia ra ON ra.respuesta_asistencia_id = g.respuesta_asistencia_id
      JOIN arreglalo.declaracion_asistencia da ON da.asistencia_id = ra.asistencia_id
      JOIN arreglalo.reserva r ON r.reserva_id = da.reserva_id
      WHERE g.resuelta_en IS NULL AND ra.respuesta = 'rechazada'
      ORDER BY ra.respondida_en`;
    try {
      const r = await this.db.pool.query<CasoAbierto>(sql);
      return r.rows;
    } catch (e) {
      this.log.error(String(e));
      throw new ServiceUnavailableException('No se pudieron consultar los casos.');
    }
  }

  // Todo se guarda junto o no se guarda nada (transacción).
  async dictaminar(d: DatosDictamen): Promise<ResultadoDictamen> {
    let cliente: PoolClient | undefined;
    try {
      cliente = await this.db.pool.connect();
      await cliente.query('BEGIN');

      const rol = await cliente.query<{ ok: boolean }>(
        `SELECT arreglalo.tiene_rol($1::bigint, 'superadministrador') AS ok`,
        [d.responsableId],
      );
      if (!rol.rows[0].ok) { await cliente.query('ROLLBACK'); return { codigo: 'sin_permiso' }; }

      const caso = await cliente.query<{
        resuelta_en: string | null; respuesta: string; reserva_id: string; estado: string;
      }>(
        `SELECT g.resuelta_en, ra.respuesta, da.reserva_id::text AS reserva_id, r.estado
         FROM arreglalo.gestion_revision_asistencia g
         JOIN arreglalo.respuesta_asistencia ra ON ra.respuesta_asistencia_id = g.respuesta_asistencia_id
         JOIN arreglalo.declaracion_asistencia da ON da.asistencia_id = ra.asistencia_id
         JOIN arreglalo.reserva r ON r.reserva_id = da.reserva_id
         WHERE g.respuesta_asistencia_id = $1::bigint
         FOR UPDATE OF g`,
        [d.respuestaId],
      );
      if (caso.rowCount === 0) { await cliente.query('ROLLBACK'); return { codigo: 'no_encontrado' }; }
      const c = caso.rows[0];
      if (c.resuelta_en !== null) { await cliente.query('ROLLBACK'); return { codigo: 'ya_resuelta' }; }
      if (c.respuesta !== 'rechazada') { await cliente.query('ROLLBACK'); return { codigo: 'no_rechazada' }; }

      const texto = `[${d.resultado}] ${d.explicacion}`;
      // Regla de negocio: si el trabajador no asistió se cancela la reserva; si asistió, queda finalizada.
      const estadoNuevo = d.resultado === 'trabajador_asistio' ? 'finalizada' : 'cancelada';
      await cliente.query(
        `UPDATE arreglalo.gestion_revision_asistencia
         SET escalada_en = COALESCE(escalada_en, clock_timestamp()),
             resuelta_en = clock_timestamp(), responsable_id = $2::bigint, resolucion = $3::text
         WHERE respuesta_asistencia_id = $1::bigint`,
        [d.respuestaId, d.responsableId, texto],
      );
      await cliente.query(
        `UPDATE arreglalo.reserva SET estado = $2 WHERE reserva_id = $1::bigint`,
        [c.reserva_id, estadoNuevo],
      );
      await cliente.query(
        `INSERT INTO arreglalo.evento_reserva
           (reserva_id, actor_id, accion, estado_anterior, estado_nuevo, motivo)
         VALUES ($1::bigint, $2::bigint, 'resolucion_asistencia', $3, $4, $5)`,
        [c.reserva_id, d.responsableId, c.estado, estadoNuevo, texto],
      );
      await cliente.query('COMMIT');
      return { codigo: 'ok', reservaId: c.reserva_id, estadoReserva: estadoNuevo };
    } catch (e) {
      this.log.error(String(e));
      if (cliente) { try { await cliente.query('ROLLBACK'); } catch { /* sin conexión */ } }
      throw new ServiceUnavailableException('No se pudo registrar la resolución.');
    } finally {
      if (cliente) { cliente.release(); }
    }
  }
}