import type { Pool } from 'pg';
import type {
  AvisoCancelacionTrabajador,
  CancelacionClienteConfirmada,
  CancelacionClienteRepository,
  LiquidacionCancelacionCliente,
  ContextoCancelacionCliente,
} from '../../CORE/cancelacion-cliente/cancelacion-cliente.repository';

type FilaContexto = Omit<ContextoCancelacionCliente, 'fondoCentavos' | 'comisionCentavos'> & {
  fondoCentavos: string;
  comisionCentavos: string;
};

function leerCentavos(valor: string): number {
  const centavos = Number(valor);
  if (!/^\d+(?:\.0+)?$/.test(valor) || !Number.isSafeInteger(centavos)) {
    throw new Error('PostgreSQL devolvio un importe invalido para la cancelacion.');
  }
  return centavos;
}

export class PostgresCancelacionClienteRepository implements CancelacionClienteRepository {
  constructor(private readonly pool: Pool) {}

  async confirmar(
    reservaId: string,
    clienteId: string,
    motivo: string,
    esperada: LiquidacionCancelacionCliente,
  ): Promise<CancelacionClienteConfirmada> {
    const cliente = await this.pool.connect();
    let descartarConexion = false;

    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');

      const { rows: [reserva] } = await cliente.query<{ estado: string }>(
        `
        SELECT r.estado
        FROM arreglalo.reserva r
        JOIN arreglalo.v_contratacion vc USING (reserva_id)
        WHERE r.reserva_id = $1::bigint AND vc.cliente_id = $2::bigint
        FOR UPDATE OF r
        `,
        [reservaId, clienteId],
      );

      if (!reserva) {
        throw new Error('No se encontro la reserva.');
      }

      if (reserva.estado !== 'pendiente_anticipo' && reserva.estado !== 'reservada') {
        throw new Error('La reserva no esta disponible para cancelacion por el cliente.');
      }

      // El disparador fija la hora y recalcula la causal dentro del INSERT.
      const { rows: [cancelacion] } = await cliente.query<{ id: string }>(
        `
        INSERT INTO arreglalo.cancelacion (reserva_id, actor_id, causal_declarada, motivo)
        VALUES ($1::bigint, $2::bigint, $3, $4)
        RETURNING cancelacion_id::text AS id
        `,
        [reservaId, clienteId, esperada.causal, motivo],
      );

      const { rows: [fila] } = await cliente.query<{
        causal: string;
        antesDelInicio: boolean;
        fondo: string;
        comision: string;
        reembolso: string;
        compensacion: string;
      }>(
        `
        SELECT l.causal,
               c.solicitada_en < r.inicio_programado AS "antesDelInicio",
               (l.fondo_no_desembolsado * 100)::text AS fondo,
               (l.comision * 100)::text AS comision,
               (l.reembolso_debido * 100)::text AS reembolso,
               (l.compensacion_trabajador * 100)::text AS compensacion
        FROM arreglalo.v_liquidacion_cancelacion l
        JOIN arreglalo.cancelacion c USING (cancelacion_id)
        JOIN arreglalo.reserva r ON r.reserva_id = c.reserva_id
        WHERE l.cancelacion_id = $1::bigint
        `,
        [cancelacion.id],
      );

      if (!fila || !fila.antesDelInicio || fila.causal !== esperada.causal) {
        throw new Error('La vista previa cambio. Consulta el resultado antes de confirmar.');
      }

      const fondoCentavos = leerCentavos(fila.fondo);
      const comisionCentavos = leerCentavos(fila.comision);
      const reembolsoCentavos = leerCentavos(fila.reembolso);
      const compensacionTrabajadorCentavos = leerCentavos(fila.compensacion);
      const repartoPlataformaCentavos =
        fondoCentavos - reembolsoCentavos - compensacionTrabajadorCentavos;

      if (
        fondoCentavos !== esperada.fondoCentavos
        || comisionCentavos !== esperada.comisionCentavos
        || reembolsoCentavos !== esperada.reembolsoCentavos
        || compensacionTrabajadorCentavos !== esperada.compensacionTrabajadorCentavos
        || repartoPlataformaCentavos !== esperada.repartoPlataformaCentavos
      ) {
        throw new Error('La vista previa cambio. Consulta el resultado antes de confirmar.');
      }

      let solicitudFinancieraId: string | null = null;
      const importeCentavos = reembolsoCentavos || compensacionTrabajadorCentavos;
      if (importeCentavos > 0) {
        const tipo = reembolsoCentavos > 0 ? 'reembolso' : 'compensacion_trabajador';
        const { rows: [solicitud] } = await cliente.query<{ id: string }>(
          `
          INSERT INTO arreglalo.solicitud_financiera
            (reserva_id, tipo, importe_solicitado, solicitante_id)
          VALUES ($1::bigint, $2, $3::numeric / 100, $4::bigint)
          RETURNING solicitud_financiera_id::text AS id
          `,
          [reservaId, tipo, importeCentavos, clienteId],
        );
        solicitudFinancieraId = solicitud.id;
      }

      await cliente.query('COMMIT');
      return {
        cancelacionId: cancelacion.id,
        reservaId,
        solicitudFinancieraId,
        causal: esperada.causal,
        fondoCentavos,
        comisionCentavos,
        reembolsoCentavos,
        compensacionTrabajadorCentavos,
        repartoPlataformaCentavos,
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

  async consultarAvisosDelTrabajador(trabajadorId: string): Promise<AvisoCancelacionTrabajador[]> {
    const { rows } = await this.pool.query<AvisoCancelacionTrabajador>(
      `
      SELECT c.cancelacion_id::text AS "cancelacionId",
             c.reserva_id::text AS "reservaId",
             c.solicitada_en AS "canceladaEn",
             vc.inicio_programado AS "inicioProgramado"
      FROM arreglalo.cancelacion c
      JOIN arreglalo.v_contratacion vc ON vc.reserva_id = c.reserva_id
      WHERE vc.trabajador_id = $1::bigint
        AND arreglalo.tiene_rol($1::bigint, 'trabajador')
        AND vc.estado = 'cancelada'
        AND c.actor_id = vc.cliente_id
        AND c.decision_id IS NULL
        AND c.causal_declarada IN ('cliente_anticipada', 'cliente_tardia')
      ORDER BY c.solicitada_en DESC, c.cancelacion_id DESC
      LIMIT 50
      `,
      [trabajadorId],
    );

    return rows;
  }

  async consultarContexto(
    reservaId: string,
    clienteId: string,
  ): Promise<ContextoCancelacionCliente | null> {
    const { rows: [fila] } = await this.pool.query<FilaContexto>(
      `
      WITH reloj AS MATERIALIZED (
        SELECT clock_timestamp() AS ahora
      )
      SELECT vc.estado,
             vc.inicio_programado AS "inicioProgramado",
             reloj.ahora AS "consultadaEn",
             (greatest(0::numeric, m.recibido - m.desembolsado - calculo.comision)
               * 100)::text AS "fondoCentavos",
             (calculo.comision * 100)::text AS "comisionCentavos",
             (
               EXISTS (
                 SELECT 1
                 FROM arreglalo.compromiso_fondo c
                 JOIN arreglalo.decision_financiera d USING (decision_financiera_id)
                 JOIN arreglalo.solicitud_financiera s USING (solicitud_financiera_id)
                 WHERE s.reserva_id = vc.reserva_id AND c.cerrado_en IS NULL
               )
               OR EXISTS (
                 SELECT 1
                 FROM arreglalo.movimiento_financiero x
                 JOIN arreglalo.solicitud_financiera s USING (solicitud_financiera_id)
                 WHERE s.reserva_id = vc.reserva_id
                   AND x.estado IN ('iniciado', 'incierto')
               )
             ) AS "requiereConciliacion"
      FROM arreglalo.v_contratacion vc
      JOIN arreglalo.regla_financiera rf USING (regla_id)
      CROSS JOIN reloj
      CROSS JOIN LATERAL (
        SELECT round(
          round(arreglalo.precio_reserva(vc.reserva_id, reloj.ahora) * rf.tasa_anticipo, 2)
            * rf.tasa_comision,
          2
        ) AS comision
      ) calculo
      CROSS JOIN LATERAL (
        SELECT coalesce(sum(x.importe_ejecutado::numeric) FILTER (
                 WHERE s.tipo IN ('anticipo', 'complemento_anticipo')
               ), 0) AS recibido,
               coalesce(sum(x.importe_ejecutado::numeric) FILTER (
                 WHERE s.tipo = 'desembolso'
               ), 0) AS desembolsado
        FROM arreglalo.movimiento_financiero x
        JOIN arreglalo.solicitud_financiera s USING (solicitud_financiera_id)
        WHERE s.reserva_id = vc.reserva_id
          AND x.estado = 'confirmado'
          AND x.confirmado_en <= reloj.ahora
      ) m
      WHERE vc.reserva_id = $1::bigint AND vc.cliente_id = $2::bigint
      `,
      [reservaId, clienteId],
    );

    if (!fila) {
      return null;
    }

    return {
      ...fila,
      fondoCentavos: leerCentavos(fila.fondoCentavos),
      comisionCentavos: leerCentavos(fila.comisionCentavos),
    };
  }
}
