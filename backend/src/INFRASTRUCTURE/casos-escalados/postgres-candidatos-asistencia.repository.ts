import type { Pool } from 'pg';
import type { CandidatoAsistencia, CandidatosAsistenciaRepository } from '../../CORE/casos-escalados/candidatos-asistencia.repository';

export class PostgresCandidatosAsistenciaRepository implements CandidatosAsistenciaRepository {
  constructor(private readonly pool: Pool) {}

  async listarVencidos(actorId: string): Promise<CandidatoAsistencia[] | null> {
    const { rows } = await this.pool.query<CandidatoAsistencia | { respuestaId: null }>(
      `
      WITH permiso AS MATERIALIZED (
        SELECT arreglalo.tiene_rol($1::bigint, 'superadministrador') IS TRUE AS autorizado
      ),
      reloj AS (
        SELECT (statement_timestamp() AT TIME ZONE 'America/La_Paz')::date AS hoy
      )
      SELECT candidato.*
      FROM permiso
      CROSS JOIN reloj
      LEFT JOIN LATERAL (
        SELECT ra.respuesta_asistencia_id::text AS "respuestaId",
               da.asistencia_id::text AS "asistenciaId",
               da.reserva_id::text AS "reservaId",
               ra.respondida_en AS "rechazadaEn",
               to_char(plazo.vence_el, 'YYYY-MM-DD') AS "fechaVencimientoBolivia"
        FROM arreglalo.respuesta_asistencia ra
        JOIN arreglalo.declaracion_asistencia da USING (asistencia_id)
        CROSS JOIN LATERAL (
          SELECT (ra.respondida_en AT TIME ZONE 'America/La_Paz')::date AS fecha
        ) rechazo
        CROSS JOIN LATERAL (
          SELECT rechazo.fecha + dias.numero AS vence_el
          FROM generate_series(1, 7) AS dias(numero)
          WHERE extract(isodow FROM rechazo.fecha + dias.numero) BETWEEN 1 AND 5
          ORDER BY dias.numero
          OFFSET 1 LIMIT 1
        ) plazo
        WHERE permiso.autorizado
          AND ra.respuesta = 'rechazada'
          AND reloj.hoy > plazo.vence_el
        ORDER BY ra.respondida_en, ra.respuesta_asistencia_id
        LIMIT 50
      ) candidato ON true
      WHERE permiso.autorizado
      ORDER BY candidato."rechazadaEn", candidato."respuestaId"::bigint
      `,
      [actorId],
    );

    if (rows.length === 0) {
      return null;
    }

    return rows.filter((fila): fila is CandidatoAsistencia => fila.respuestaId !== null);
  }
}
