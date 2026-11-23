import type { Pool } from 'pg';

export interface CodigoFinalizacionGuardado {
  id: string;
  generadoEn: Date;
}

export class PostgresEmisionCodigoRepository {
  constructor(private readonly pool: Pool) {}

  async guardar(
    reservaId: string,
    trabajadorId: string,
    hash: string,
  ): Promise<CodigoFinalizacionGuardado> {
    const cliente = await this.pool.connect();
    let descartarConexion = false;

    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');

      await cliente.query(
        `
        SELECT reserva_id
        FROM arreglalo.reserva
        WHERE reserva_id = $1::bigint
        FOR UPDATE
        `,
        [reservaId],
      );

      const { rows: [reserva] } = await cliente.query<{
        trabajadorId: string;
        estado: string;
      }>(
        `
        SELECT trabajador_id::text AS "trabajadorId", estado
        FROM arreglalo.v_contratacion
        WHERE reserva_id = $1::bigint
        `,
        [reservaId],
      );

      if (!reserva) {
        throw new Error('No se encontro la reserva.');
      }

      if (reserva.trabajadorId !== trabajadorId) {
        throw new Error('Solo el trabajador contratado puede solicitar el codigo.');
      }

      if (reserva.estado !== 'en_ejecucion') {
        throw new Error('La reserva debe estar en ejecucion para generar un codigo.');
      }

      const { rows: [guardado] } =
        await cliente.query<CodigoFinalizacionGuardado>(
          `
          INSERT INTO arreglalo.codigo_finalizacion (reserva_id, hash_codigo)
          VALUES ($1::bigint, $2)
          RETURNING codigo_id::text AS id, generado_en AS "generadoEn"
          `,
          [reservaId, hash],
        );

      if (!guardado) {
        throw new Error('PostgreSQL no devolvio el codigo registrado.');
      }

      await cliente.query('COMMIT');
      return guardado;
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