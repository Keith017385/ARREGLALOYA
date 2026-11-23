import type { Pool, PoolClient } from 'pg';
import type {
  DatosCalificacion,
  ReservaParaCalificacion,
} from '../../CORE/calificacion-opinion/calificacion-opinion';
import type {
  CalificacionOpinionRepository,
  CalificacionRegistrada,
  OperacionesCalificacion,
} from '../../CORE/calificacion-opinion/calificacion-opinion.repository';

async function obtenerReserva(
  cliente: PoolClient,
  reservaId: string,
): Promise<ReservaParaCalificacion | null> {
  const { rows: [reserva] } = await cliente.query<ReservaParaCalificacion>(
    `
    SELECT cliente_id::text AS "clienteId", estado
    FROM arreglalo.v_contratacion
    WHERE reserva_id = $1::bigint
    `,
    [reservaId],
  );

  return reserva ?? null;
}

async function registrar(
  cliente: PoolClient,
  reservaId: string,
  datos: DatosCalificacion,
): Promise<CalificacionRegistrada> {
  const { rows: [fila] } = await cliente.query<
    Omit<CalificacionRegistrada, 'puntuacion'> & { puntuacion: string }
  >(
    `
    WITH nueva_calificacion AS (
      INSERT INTO arreglalo.calificacion (reserva_id)
      VALUES ($1::bigint)
      RETURNING calificacion_id, reserva_id
    ),
    primera_version AS (
      INSERT INTO arreglalo.version_calificacion
        (calificacion_id, version, puntuacion, opinion)
      SELECT calificacion_id, 1, $2::numeric, $3::text
      FROM nueva_calificacion
      RETURNING calificacion_id, version, puntuacion, opinion, registrada_en
    )
    SELECT v.calificacion_id::text AS id,
           c.reserva_id::text AS "reservaId",
           v.version,
           v.puntuacion::text AS puntuacion,
           v.opinion,
           v.registrada_en AS "registradaEn"
    FROM primera_version v
    JOIN nueva_calificacion c USING (calificacion_id)
    `,
    [reservaId, datos.puntuacion, datos.opinion],
  );

  if (!fila) {
    throw new Error('PostgreSQL no devolvio la calificacion registrada.');
  }

  return { ...fila, puntuacion: Number(fila.puntuacion) };
}

export class PostgresCalificacionOpinionRepository implements CalificacionOpinionRepository {
  constructor(private readonly pool: Pool) {}

  async enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesCalificacion) => Promise<T>,
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
        obtenerReserva: () => obtenerReserva(cliente, reservaId),
        registrar: (datos) => registrar(cliente, reservaId, datos),
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
}
