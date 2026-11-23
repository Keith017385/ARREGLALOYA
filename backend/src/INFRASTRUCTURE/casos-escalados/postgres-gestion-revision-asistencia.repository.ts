import type { Pool } from 'pg';
import type { RevisionAsistencia } from '../../CORE/casos-escalados/gestion-revision-asistencia';
import type {
  BandejaRevisionAsistencia,
  CambioRevisionAsistencia,
  RevisionAsistenciaAbierta,
  GestionAsistenciaRegistrada,
  GestionRevisionAsistenciaRepository,
} from '../../CORE/casos-escalados/gestion-revision-asistencia.repository';

export class PostgresGestionRevisionAsistenciaRepository
  implements GestionRevisionAsistenciaRepository {
  constructor(private readonly pool: Pool) {}

  async listarAbiertas(actorId: string): Promise<BandejaRevisionAsistencia | null> {
    type Fila = { ahora: Date } & (RevisionAsistenciaAbierta | { respuestaId: null });

    const { rows } = await this.pool.query<Fila>(
      `
      WITH permiso AS MATERIALIZED (
        SELECT arreglalo.tiene_rol($1::bigint, 'superadministrador') IS TRUE AS autorizado
      )
      SELECT statement_timestamp() AS ahora, caso.*
      FROM permiso
      LEFT JOIN LATERAL (
        SELECT ra.respuesta_asistencia_id::text AS "respuestaId",
               da.asistencia_id::text AS "asistenciaId",
               da.reserva_id::text AS "reservaId",
               da.declarada_en AS "declaradaEn",
               ra.respondida_en AS "rechazadaEn",
               g.escalada_en AS "escaladaEn"
        FROM arreglalo.gestion_revision_asistencia g
        JOIN arreglalo.respuesta_asistencia ra USING (respuesta_asistencia_id)
        JOIN arreglalo.declaracion_asistencia da USING (asistencia_id)
        WHERE permiso.autorizado
          AND ra.respuesta = 'rechazada'
          AND g.resuelta_en IS NULL
        ORDER BY (g.escalada_en IS NULL), ra.respondida_en, ra.respuesta_asistencia_id
        LIMIT 50
      ) caso ON true
      WHERE permiso.autorizado
      ORDER BY (caso."escaladaEn" IS NULL), caso."rechazadaEn", caso."respuestaId"::bigint
      `,
      [actorId],
    );

    if (rows.length === 0) {
      return null;
    }

    const revisiones: RevisionAsistenciaAbierta[] = [];
    for (const fila of rows) {
      if (fila.respuestaId !== null) {
        const { ahora, ...revision } = fila;
        revisiones.push(revision);
      }
    }

    return { ahora: rows[0].ahora, revisiones };
  }

  async actualizar(
    respuestaId: string,
    actorId: string,
    decidir: (revision: RevisionAsistencia, ahora: Date) => CambioRevisionAsistencia,
  ): Promise<GestionAsistenciaRegistrada> {
    const cliente = await this.pool.connect();
    let descartarConexion = false;

    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');

      const { rows: [permiso] } = await cliente.query<{ autorizado: boolean }>(
        `SELECT arreglalo.tiene_rol($1::bigint, 'superadministrador') IS TRUE AS autorizado`,
        [actorId],
      );
      if (permiso.autorizado !== true) {
        throw new Error('Se requiere un superadministrador activo.');
      }

      const { rows: [revision] } = await cliente.query<RevisionAsistencia>(
        `
        SELECT ra.respuesta,
               ra.respondida_en AS "respondidaEn",
               g.escalada_en AS "escaladaEn",
               g.resuelta_en AS "resueltaEn"
        FROM arreglalo.gestion_revision_asistencia g
        JOIN arreglalo.respuesta_asistencia ra USING (respuesta_asistencia_id)
        WHERE g.respuesta_asistencia_id = $1::bigint
        FOR UPDATE OF g, ra
        `,
        [respuestaId],
      );
      if (!revision) {
        throw new Error('No se encontro una revision registrada para esta respuesta.');
      }

      // Lee la hora despues de adquirir el bloqueo.
      const { rows: [reloj] } = await cliente.query<{ ahora: Date }>(
        'SELECT clock_timestamp() AS ahora',
      );
      const cambio = decidir(revision, reloj.ahora);

      const { rows: [guardada] } = await cliente.query<GestionAsistenciaRegistrada>(
        `
        UPDATE arreglalo.gestion_revision_asistencia g
        SET escalada_en = CASE WHEN $3 = 'escalar' THEN clock_timestamp() ELSE g.escalada_en END,
            resuelta_en = CASE WHEN $3 = 'resolver' THEN clock_timestamp() ELSE g.resuelta_en END,
            responsable_id = CASE WHEN $3 = 'resolver' THEN $2::bigint ELSE g.responsable_id END,
            resolucion = CASE WHEN $3 = 'resolver' THEN $4::text ELSE g.resolucion END
        WHERE g.respuesta_asistencia_id = $1::bigint
          AND g.resuelta_en IS NULL
          AND arreglalo.tiene_rol($2::bigint, 'superadministrador') IS TRUE
          AND (
            ($3 = 'escalar' AND g.escalada_en IS NULL)
            OR ($3 = 'resolver' AND g.escalada_en IS NOT NULL)
          )
        RETURNING g.respuesta_asistencia_id::text AS "respuestaId",
                  g.escalada_en AS "escaladaEn",
                  g.resuelta_en AS "resueltaEn",
                  g.responsable_id::text AS "responsableId",
                  g.resolucion
        `,
        [respuestaId, actorId, cambio.tipo, cambio.tipo === 'resolver' ? cambio.resolucion : null],
      );
      if (!guardada) {
        throw new Error('La revision o el permiso cambio antes de guardar.');
      }

      await cliente.query('COMMIT');
      return guardada;
    } catch (error) {
      try {
        await cliente.query('ROLLBACK');
      } catch {
        descartarConexion = true;
      }
      throw error;
    } finally {
      cliente.release(descartarConexion);
    }
  }
}
