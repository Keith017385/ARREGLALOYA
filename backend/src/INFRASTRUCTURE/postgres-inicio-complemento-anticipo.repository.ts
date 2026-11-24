import type { Pool } from 'pg';
import type { SolicitudComplementoAnticipo, InicioComplementoAnticipoRepository } from '../CORE/complemento-anticipo.repository';

export class PostgresInicioComplementoAnticipoRepository implements InicioComplementoAnticipoRepository {
  constructor(private readonly pool: Pool) {}

  async iniciar(
    reservaId: string,
    clienteId: string,
  ): Promise<SolicitudComplementoAnticipo> {
    const cliente = await this.pool.connect();
    let descartarConexion = false;

    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');

      // Mismo orden que validar_solicitud_financiera:
      // primero los usuarios y luego la reserva.
      const participantes = await cliente.query(
        `
        SELECT u.usuario_id
        FROM arreglalo.usuario AS u
        JOIN arreglalo.v_contratacion AS vc
          ON u.usuario_id IN (vc.cliente_id, vc.trabajador_id)
        WHERE vc.reserva_id = $1::bigint
          AND vc.cliente_id = $2::bigint
        ORDER BY u.usuario_id
        FOR UPDATE OF u
        `,
        [reservaId, clienteId],
      );

      if (participantes.rowCount === 0) {
        throw new Error('La reserva no pertenece al cliente.');
      }

      await cliente.query(
        `
        SELECT reserva_id
        FROM arreglalo.reserva
        WHERE reserva_id = $1::bigint
        FOR UPDATE
        `,
        [reservaId],
      );

      const { rows: [fondo] } = await cliente.query<{ pendiente: string }>(
        `
        SELECT f.complemento_anticipo::text AS pendiente
        FROM arreglalo.v_contratacion AS vc
        JOIN arreglalo.v_fondo AS f USING (reserva_id)
        WHERE vc.reserva_id = $1::bigint
          AND vc.cliente_id = $2::bigint
          AND vc.estado IN ('reservada', 'en_ejecucion')
          AND f.complemento_anticipo > 0
        `,
        [reservaId, clienteId],
      );

      if (!fondo) {
        throw new Error('No hay un complemento cobrable para esta reserva.');
      }

      const cobrosEnCurso = await cliente.query(
        `
        SELECT 1
        FROM arreglalo.solicitud_financiera AS sf
        JOIN arreglalo.movimiento_financiero AS m USING (solicitud_financiera_id)
        WHERE sf.reserva_id = $1::bigint
          AND sf.tipo IN ('anticipo', 'complemento_anticipo')
          AND m.estado IN ('iniciado', 'incierto')
        LIMIT 1
        `,
        [reservaId],
      );

      if (cobrosEnCurso.rowCount) {
        throw new Error('Ya hay un cobro en curso para esta reserva.');
      }

      const { rows: [existente] } = await cliente.query<{ id: string }>(
        `
        SELECT sf.solicitud_financiera_id::text AS id
        FROM arreglalo.solicitud_financiera AS sf
        WHERE sf.reserva_id = $1::bigint
          AND sf.solicitante_id = $2::bigint
          AND sf.tipo = 'complemento_anticipo'
          AND sf.importe_solicitado::numeric = $3::numeric
          AND NOT EXISTS (
            SELECT 1
            FROM arreglalo.movimiento_financiero AS m
            WHERE m.solicitud_financiera_id = sf.solicitud_financiera_id
              AND m.estado <> 'fallido'
          )
        ORDER BY sf.solicitud_financiera_id DESC
        LIMIT 1
        `,
        [reservaId, clienteId, fondo.pendiente],
      );

      let solicitudId = existente?.id;

      if (!solicitudId) {
        const { rows: [nueva] } = await cliente.query<{ id: string }>(
          `
          INSERT INTO arreglalo.solicitud_financiera (
              reserva_id, tipo, importe_solicitado, solicitante_id
          )
          VALUES ($1::bigint, 'complemento_anticipo', $3::numeric, $2::bigint)
          RETURNING solicitud_financiera_id::text AS id
          `,
          [reservaId, clienteId, fondo.pendiente],
        );

        if (!nueva) {
          throw new Error('PostgreSQL no devolvio la solicitud creada.');
        }
        solicitudId = nueva.id;
      }

      await cliente.query('COMMIT');

      return {
        solicitudId,
        importeSolicitado: fondo.pendiente,
        reutilizada: Boolean(existente),
      };
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