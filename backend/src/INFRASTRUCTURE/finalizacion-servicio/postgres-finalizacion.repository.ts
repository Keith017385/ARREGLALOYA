import type { Pool, PoolClient } from 'pg';
import type { ReservaParaFinalizacion } from '../../CORE/finalizacion-servicio/confirmacion-finalizacion';
import type {
  CodigoRegistrado,
  FinalizacionRegistrada,
  FinalizacionRepository,
  OperacionesFinalizacion,
} from '../../CORE/finalizacion-servicio/finalizacion.repository';

async function bloquearContratacion(
  cliente: PoolClient,
  reservaId: string,
): Promise<void> {
  await cliente.query(
    `
    SELECT u.usuario_id
    FROM arreglalo.usuario AS u
    JOIN arreglalo.v_contratacion AS vc
      ON u.usuario_id IN (vc.cliente_id, vc.trabajador_id)
    WHERE vc.reserva_id = $1::bigint
    ORDER BY u.usuario_id
    FOR UPDATE OF u
    `,
    [reservaId],
  );

  await cliente.query(
    `
    SELECT reserva_id
    FROM arreglalo.reserva
    WHERE reserva_id = $1::bigint
    FOR UPDATE
    `,
    [reservaId],
  );
}

async function obtenerReserva(
  cliente: PoolClient,
  reservaId: string,
): Promise<ReservaParaFinalizacion | null> {
  const { rows } = await cliente.query<ReservaParaFinalizacion>(
    `
    SELECT reserva_id::text AS id,
           cliente_id::text AS "clienteId",
           estado
    FROM arreglalo.v_contratacion
    WHERE reserva_id = $1::bigint
    `,
    [reservaId],
  );

  return rows[0] ?? null;
}

async function buscarCodigoPorHash(
  cliente: PoolClient,
  reservaId: string,
  hash: string,
): Promise<CodigoRegistrado | null> {
  const { rows } = await cliente.query<CodigoRegistrado>(
    `
    SELECT c.codigo_id::text AS id,
           c.reserva_id::text AS "reservaId",
           f.confirmada_en AS "consumidoEn"
    FROM arreglalo.codigo_finalizacion AS c
    LEFT JOIN arreglalo.finalizacion AS f USING (codigo_id)
    WHERE c.reserva_id = $1::bigint
      AND c.hash_codigo = $2
      AND c.codigo_id = (
          SELECT ultimo.codigo_id
          FROM arreglalo.codigo_finalizacion AS ultimo
          WHERE ultimo.reserva_id = $1::bigint
          ORDER BY ultimo.generado_en DESC, ultimo.codigo_id DESC
          LIMIT 1
      )
    `,
    [reservaId, hash],
  );

  return rows[0] ?? null;
}

async function registrarFinalizacion(
  cliente: PoolClient,
  reservaId: string,
  codigoId: string,
): Promise<FinalizacionRegistrada> {
  const { rows } = await cliente.query<FinalizacionRegistrada>(
    `
    INSERT INTO arreglalo.finalizacion (codigo_id)
    SELECT codigo_id
    FROM arreglalo.codigo_finalizacion
    WHERE reserva_id = $1::bigint
      AND codigo_id = $2::bigint
    RETURNING finalizacion_id::text AS id,
              confirmada_en AS "confirmadaEn"
    `,
    [reservaId, codigoId],
  );

  const fila = rows[0];
  if (!fila) {
    throw new Error('El codigo no es valido para esta reserva.');
  }

  return fila;
}

async function marcarReservaFinalizada(
  cliente: PoolClient,
  reservaId: string,
): Promise<void> {
  const resultado = await cliente.query(
    `
    UPDATE arreglalo.reserva
    SET estado = 'finalizada'
    WHERE reserva_id = $1::bigint
      AND estado = 'en_ejecucion'
    `,
    [reservaId],
  );

  if (resultado.rowCount !== 1) {
    throw new Error('La reserva debe estar en ejecucion para finalizar.');
  }
}

export class PostgresFinalizacionRepository implements FinalizacionRepository {
  constructor(private readonly pool: Pool) {}

  async enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesFinalizacion) => Promise<T>,
  ): Promise<T> {
    const cliente = await this.pool.connect();
    let descartarConexion = false;

    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await bloquearContratacion(cliente, reservaId);

      const resultado = await ejecutar({
        obtenerReserva: () => obtenerReserva(cliente, reservaId),
        buscarCodigoPorHash: (hash) =>
          buscarCodigoPorHash(cliente, reservaId, hash),
        registrarFinalizacion: (codigoId) =>
          registrarFinalizacion(cliente, reservaId, codigoId),
        marcarReservaFinalizada: () =>
          marcarReservaFinalizada(cliente, reservaId),
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