import type { Pool } from 'pg';
import type { DeclaracionParaResponder } from '../../CORE/declaracion-asistencia/declaracion-asistencia';
import type {
  AsistenciaRechazada,
  DeclaracionAsistenciaRegistrada,
  DeclaracionAsistenciaRepository,
  OperacionesAsistencia,
  RespuestaAsistenciaRegistrada,
} from '../../CORE/declaracion-asistencia/declaracion-asistencia.repository';

export class PostgresDeclaracionAsistenciaRepository implements DeclaracionAsistenciaRepository {
  constructor(private readonly pool: Pool) {}

  async enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesAsistencia) => Promise<T>,
  ): Promise<T> {
    const cliente = await this.pool.connect();
    let descartarConexion = false;

    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await cliente.query(
        'SELECT reserva_id FROM arreglalo.reserva WHERE reserva_id = $1::bigint FOR UPDATE',
        [reservaId],
      );

      const resultado = await ejecutar({
        buscarDeclaracion: async (asistenciaId) => {
          const { rows: [fila] } = await cliente.query<DeclaracionParaResponder>(
            `
            SELECT vc.cliente_id::text AS "clienteId", ra.respuesta
            FROM arreglalo.declaracion_asistencia da
            JOIN arreglalo.v_contratacion vc ON vc.reserva_id = da.reserva_id
            LEFT JOIN arreglalo.respuesta_asistencia ra USING (asistencia_id)
            WHERE da.reserva_id = $1::bigint AND da.asistencia_id = $2::bigint
            `,
            [reservaId, asistenciaId],
          );
          return fila ?? null;
        },
        guardarRespuesta: async (asistenciaId, respuesta) => {
          const { rows: [fila] } = await cliente.query<RespuestaAsistenciaRegistrada>(
            `
            INSERT INTO arreglalo.respuesta_asistencia (asistencia_id, respuesta)
            SELECT da.asistencia_id, $3::text
            FROM arreglalo.declaracion_asistencia da
            WHERE da.reserva_id = $1::bigint AND da.asistencia_id = $2::bigint
            ON CONFLICT (asistencia_id) DO NOTHING
            RETURNING respuesta_asistencia_id::text AS id,
                      asistencia_id::text AS "asistenciaId",
                      respuesta,
                      respondida_en AS "respondidaEn"
            `,
            [reservaId, asistenciaId, respuesta],
          );
          return fila ?? null;
        },
      });

      await cliente.query('COMMIT');
      return resultado;
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

  async consultarRechazadas(actorId: string): Promise<AsistenciaRechazada[] | null> {
    const { rows } = await this.pool.query<AsistenciaRechazada | { respuestaId: null }>(
      `
      SELECT rechazo.*
      FROM (SELECT arreglalo.es_administrador($1::bigint) AS autorizado) permiso
      LEFT JOIN LATERAL (
        SELECT da.reserva_id::text AS "reservaId",
               da.asistencia_id::text AS "asistenciaId",
               ra.respuesta_asistencia_id::text AS "respuestaId",
               da.declarada_en AS "declaradaEn",
               ra.respondida_en AS "respondidaEn"
        FROM arreglalo.respuesta_asistencia ra
        JOIN arreglalo.declaracion_asistencia da USING (asistencia_id)
        WHERE permiso.autorizado IS TRUE
          AND ra.respuesta = 'rechazada'
        ORDER BY ra.respondida_en, ra.respuesta_asistencia_id
        LIMIT 50
      ) rechazo ON true
      WHERE permiso.autorizado IS TRUE
      ORDER BY rechazo."respondidaEn", rechazo."respuestaId"::bigint
      `,
      [actorId],
    );

    if (rows.length === 0) {
      return null;
    }

    return rows.filter((fila): fila is AsistenciaRechazada => fila.respuestaId !== null);
  }

  async consultarDelCliente(
    reservaId: string,
    clienteId: string,
  ): Promise<DeclaracionAsistenciaRegistrada[] | null> {
    const { rows } = await this.pool.query<DeclaracionAsistenciaRegistrada | { id: null }>(
      `
      SELECT da.asistencia_id::text AS id,
             vc.reserva_id::text AS "reservaId",
             da.declarada_en AS "declaradaEn",
             ra.respuesta,
             ra.respondida_en AS "respondidaEn"
      FROM arreglalo.v_contratacion vc
      LEFT JOIN arreglalo.declaracion_asistencia da ON da.reserva_id = vc.reserva_id
      LEFT JOIN arreglalo.respuesta_asistencia ra USING (asistencia_id)
      WHERE vc.reserva_id = $1::bigint AND vc.cliente_id = $2::bigint
      ORDER BY da.declarada_en DESC, da.asistencia_id DESC
      `,
      [reservaId, clienteId],
    );

    if (rows.length === 0) {
      return null;
    }
    return rows.filter((fila): fila is DeclaracionAsistenciaRegistrada => fila.id !== null);
  }
}
