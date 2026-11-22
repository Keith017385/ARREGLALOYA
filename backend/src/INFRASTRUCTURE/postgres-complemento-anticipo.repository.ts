import type { Pool } from 'pg';

export interface ComplementoAnticipoPendiente {
  reservaId: string;
  precioFinal: string;
  anticipoObjetivo: string;
  anticipoRecibido: string;
  complementoPendiente: string;
}

export class PostgresComplementoAnticipoRepository {
  constructor(private readonly pool: Pool) {}

  async consultar(
    reservaId: string,
    clienteId: string,
  ): Promise<ComplementoAnticipoPendiente | null> {
    const { rows } = await this.pool.query<ComplementoAnticipoPendiente>(
      `
      SELECT
          vc.reserva_id::text AS "reservaId",
          f.precio_final::text AS "precioFinal",
          f.anticipo_objetivo::text AS "anticipoObjetivo",
          f.recibido::text AS "anticipoRecibido",
          f.complemento_anticipo::text AS "complementoPendiente"
      FROM arreglalo.v_contratacion AS vc
      JOIN arreglalo.v_fondo AS f USING (reserva_id)
      WHERE vc.reserva_id = $1::bigint
        AND vc.cliente_id = $2::bigint
        AND vc.estado IN ('pendiente_anticipo', 'reservada', 'en_ejecucion')
      `,
      [reservaId, clienteId],
    );

    return rows[0] ?? null;
  }
}