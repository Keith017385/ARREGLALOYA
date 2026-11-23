import type { Pool, PoolClient } from 'pg';
import type { ReservaParaReclamo } from '../../CORE/reclamo-formal/reclamo-formal';
import type {
  OperacionesReclamo,
  ReclamoFormalRepository,
  ReclamoRegistrado,
} from '../../CORE/reclamo-formal/reclamo-formal.repository';

async function obtenerContexto(cliente: PoolClient, reservaId: string) {
  const { rows: [fila] } = await cliente.query<ReservaParaReclamo & { ahora: Date }>(
    `
    SELECT vc.cliente_id::text AS "clienteId",
           (
             SELECT max(f.confirmada_en)
             FROM arreglalo.finalizacion f
             JOIN arreglalo.codigo_finalizacion c USING (codigo_id)
             WHERE c.reserva_id = vc.reserva_id
           ) AS "finalizadaEn",
           clock_timestamp() AS ahora
    FROM arreglalo.v_contratacion vc
    WHERE vc.reserva_id = $1::bigint
    `,
    [reservaId],
  );

  if (!fila) {
    return null;
  }

  const { ahora, ...reserva } = fila;
  return { reserva, ahora };
}

async function registrar(
  cliente: PoolClient,
  reservaId: string,
  reportanteId: string,
  descripcion: string,
  presentadoEn: Date,
): Promise<ReclamoRegistrado> {
  const { rows: [reclamo] } = await cliente.query<ReclamoRegistrado>(
    `
    INSERT INTO arreglalo.reclamo (reserva_id, reportante_id, descripcion, presentado_en)
    VALUES ($1::bigint, $2::bigint, $3, $4::timestamptz)
    RETURNING reclamo_id::text AS id,
              reserva_id::text AS "reservaId",
              descripcion,
              estado,
              presentado_en AS "presentadoEn"
    `,
    [reservaId, reportanteId, descripcion, presentadoEn],
  );

  if (!reclamo) {
    throw new Error('PostgreSQL no devolvio el reclamo registrado.');
  }

  return reclamo;
}

export class PostgresReclamoFormalRepository implements ReclamoFormalRepository {
  constructor(private readonly pool: Pool) {}

  async enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesReclamo) => Promise<T>,
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
        obtenerContexto: () => obtenerContexto(cliente, reservaId),
        registrar: (reportanteId, descripcion, presentadoEn) =>
          registrar(cliente, reservaId, reportanteId, descripcion, presentadoEn),
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

  async consultarDelCliente(
    reservaId: string,
    clienteId: string,
  ): Promise<ReclamoRegistrado[] | null> {
    const { rows } = await this.pool.query<
      { id: null } | ReclamoRegistrado
    >(
      `
      SELECT r.reclamo_id::text AS id,
             vc.reserva_id::text AS "reservaId",
             r.descripcion,
             r.estado,
             r.presentado_en AS "presentadoEn"
      FROM arreglalo.v_contratacion vc
      LEFT JOIN arreglalo.reclamo r
        ON r.reserva_id = vc.reserva_id
       AND r.reportante_id = vc.cliente_id
      WHERE vc.reserva_id = $1::bigint
        AND vc.cliente_id = $2::bigint
      ORDER BY r.presentado_en DESC, r.reclamo_id DESC
      `,
      [reservaId, clienteId],
    );

    if (rows.length === 0) {
      return null;
    }

    return rows.filter((fila): fila is ReclamoRegistrado => fila.id !== null);
  }
}
