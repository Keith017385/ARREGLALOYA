import type { Pool, PoolClient } from 'pg';
import type {
  CancelacionTrabajadorConfirmada,
  CancelacionTrabajadorRepository,
  ContextoCancelacionTrabajador,
  VistaPreviaCancelacionTrabajador,
} from '../../CORE/cancelacion-trabajador/cancelacion-trabajador.repository';

interface FilaContexto {
  estado: string;
  inicioProgramado: Date | string;
  clienteId: string;
  trabajadorId: string;
  rolTrabajadorActivo: boolean;
  requiereConciliacion: boolean;
  reembolsoCentavos: string;
  desembolsosPreviosCentavos: string;
}

const SQL_CONTEXTO = `
  SELECT r.estado,
         vc.inicio_programado AS "inicioProgramado",
         vc.cliente_id::text AS "clienteId",
         vc.trabajador_id::text AS "trabajadorId",
         arreglalo.tiene_rol($2::bigint, 'trabajador') AS "rolTrabajadorActivo",
         (
           EXISTS (
             SELECT 1
             FROM arreglalo.compromiso_fondo cf
             JOIN arreglalo.decision_financiera df USING (decision_financiera_id)
             JOIN arreglalo.solicitud_financiera sf USING (solicitud_financiera_id)
             WHERE sf.reserva_id = r.reserva_id
               AND cf.cerrado_en IS NULL
           )
           OR EXISTS (
             SELECT 1
             FROM arreglalo.movimiento_financiero mf
             JOIN arreglalo.solicitud_financiera sf USING (solicitud_financiera_id)
             WHERE sf.reserva_id = r.reserva_id
               AND mf.estado IN ('iniciado', 'incierto')
           )
         ) AS "requiereConciliacion",
         COALESCE((
           SELECT ROUND(COALESCE(SUM(mf.importe_ejecutado::numeric), 0) * 100)::text
           FROM arreglalo.solicitud_financiera sf
           JOIN arreglalo.movimiento_financiero mf USING (solicitud_financiera_id)
           WHERE sf.reserva_id = r.reserva_id
             AND sf.tipo IN ('anticipo', 'complemento_anticipo')
             AND mf.estado = 'confirmado'
             AND mf.confirmado_en <= clock_timestamp()
         ), '0') AS "reembolsoCentavos",
         COALESCE((
           SELECT ROUND(COALESCE(SUM(mf.importe_ejecutado::numeric), 0) * 100)::text
           FROM arreglalo.solicitud_financiera sf
           JOIN arreglalo.movimiento_financiero mf USING (solicitud_financiera_id)
           WHERE sf.reserva_id = r.reserva_id
             AND sf.tipo = 'desembolso'
             AND mf.estado = 'confirmado'
             AND mf.confirmado_en <= clock_timestamp()
         ), '0') AS "desembolsosPreviosCentavos"
  FROM arreglalo.reserva r
  JOIN arreglalo.v_contratacion vc USING (reserva_id)
  WHERE r.reserva_id = $1::bigint
`;

function leerCentavos(valor: string | number): number {
  const centavos = Number(valor);
  if (!Number.isSafeInteger(centavos) || centavos < 0) {
    throw new Error('PostgreSQL devolvio un importe invalido para la cancelacion.');
  }
  return centavos;
}

function mapearContexto(fila: FilaContexto): ContextoCancelacionTrabajador {
  const inicioProgramado = fila.inicioProgramado instanceof Date
    ? fila.inicioProgramado
    : new Date(fila.inicioProgramado);

  if (!Number.isFinite(inicioProgramado.getTime())) {
    throw new Error('PostgreSQL devolvio una fecha de reserva invalida.');
  }

  return {
    estado: fila.estado,
    inicioProgramado,
    clienteId: fila.clienteId,
    trabajadorId: fila.trabajadorId,
    rolTrabajadorActivo: fila.rolTrabajadorActivo,
    requiereConciliacion: fila.requiereConciliacion,
    reembolsoCentavos: leerCentavos(fila.reembolsoCentavos),
    desembolsosPreviosCentavos: leerCentavos(fila.desembolsosPreviosCentavos),
  };
}

function validarActorYEstado(
  contexto: ContextoCancelacionTrabajador,
  trabajadorId: string,
): void {
  if (contexto.trabajadorId !== trabajadorId) {
    throw new Error('El usuario no corresponde al trabajador contratado.');
  }
  if (!contexto.rolTrabajadorActivo) {
    throw new Error('El usuario no tiene un rol de trabajador activo.');
  }
  if (!['pendiente_anticipo', 'reservada', 'en_ejecucion'].includes(contexto.estado)) {
    throw new Error('La reserva no esta disponible para cancelacion por el trabajador.');
  }
  if (contexto.requiereConciliacion) {
    throw new Error('Hay compromisos o movimientos abiertos que deben conciliarse antes de cancelar.');
  }
}

function compararVistaPrevia(
  contexto: ContextoCancelacionTrabajador,
  reservaId: string,
  vista: VistaPreviaCancelacionTrabajador,
): void {
  const fechaEsperada = new Date(vista.inicioProgramado);
  if (
    vista.reservaId !== reservaId
    || vista.estado !== contexto.estado
    || !Number.isFinite(fechaEsperada.getTime())
    || fechaEsperada.getTime() !== contexto.inicioProgramado.getTime()
    || vista.reembolsoCentavos !== contexto.reembolsoCentavos
    || vista.desembolsosPreviosCentavos !== contexto.desembolsosPreviosCentavos
  ) {
    throw new Error('La vista previa cambio. Consulta el resultado antes de confirmar.');
  }
}

export class PostgresCancelacionTrabajadorRepository implements CancelacionTrabajadorRepository {
  constructor(private readonly pool: Pool) {}

  async consultarContexto(
    reservaId: string,
    trabajadorId: string,
  ): Promise<ContextoCancelacionTrabajador | null> {
    const { rows: [fila] } = await this.pool.query<FilaContexto>(
      SQL_CONTEXTO,
      [reservaId, trabajadorId],
    );

    return fila ? mapearContexto(fila) : null;
  }

  async confirmar(
    reservaId: string,
    trabajadorId: string,
    motivo: string,
    vistaPrevia: VistaPreviaCancelacionTrabajador,
  ): Promise<CancelacionTrabajadorConfirmada> {
    const cliente = await this.pool.connect();
    let descartarConexion = false;

    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');

      // Bloquea la reserva. Los triggers financieros también bloquean esta fila,
      // evitando que aparezcan anticipos o desembolsos concurrentes en medio del proceso.
      const contexto = await this.consultarContextoBloqueado(cliente, reservaId, trabajadorId);
      if (!contexto) {
        throw new Error('No se encontro la reserva.');
      }
      validarActorYEstado(contexto, trabajadorId);
      compararVistaPrevia(contexto, reservaId, vistaPrevia);

      // El trigger BEFORE INSERT fija la causal y la hora exacta de la cancelación.
      // El trigger AFTER INSERT cancela la reserva y crea las deudas por desembolsos.
      const { rows: [cancelacion] } = await cliente.query<{ id: string }>(
        `
        INSERT INTO arreglalo.cancelacion
          (reserva_id, actor_id, causal_declarada, motivo)
        VALUES ($1::bigint, $2::bigint, 'trabajador_cancela', $3::text)
        RETURNING cancelacion_id::text AS id
        `,
        [reservaId, trabajadorId, motivo],
      );

      if (!cancelacion) {
        throw new Error('PostgreSQL no devolvio la cancelacion registrada.');
      }

      const { rows: [liquidacion] } = await cliente.query<{
        causal: string;
        reembolsoCentavos: string;
      }>(
        `
        SELECT causal,
               ROUND(reembolso_debido * 100)::text AS "reembolsoCentavos"
        FROM arreglalo.v_liquidacion_cancelacion
        WHERE cancelacion_id = $1::bigint
        `,
        [cancelacion.id],
      );

      if (!liquidacion || liquidacion.causal !== 'trabajador_cancela') {
        throw new Error('La liquidacion de la cancelacion no corresponde al trabajador.');
      }

      const reembolsoCentavos = leerCentavos(liquidacion.reembolsoCentavos);
      if (reembolsoCentavos !== vistaPrevia.reembolsoCentavos) {
        throw new Error('La vista previa cambio. Consulta el resultado antes de confirmar.');
      }

      // La solicitud es solo una petición de reembolso. La autorización y el
      // movimiento de dinero quedan para el flujo financiero administrativo.
      let solicitudFinancieraId: string | null = null;
      if (reembolsoCentavos > 0) {
        const importeSolicitado = (reembolsoCentavos / 100).toFixed(2);
        const { rows: [solicitud] } = await cliente.query<{ id: string }>(
          `
          INSERT INTO arreglalo.solicitud_financiera
            (reserva_id, tipo, importe_solicitado, solicitante_id)
          VALUES ($1::bigint, 'reembolso', $2::arreglalo.dinero_positivo, $3::bigint)
          RETURNING solicitud_financiera_id::text AS id
          `,
          [reservaId, importeSolicitado, trabajadorId],
        );
        if (!solicitud) {
          throw new Error('PostgreSQL no devolvio la solicitud financiera.');
        }
        solicitudFinancieraId = solicitud.id;

        await cliente.query(
          `
          INSERT INTO arreglalo.reembolso_cancelacion
            (solicitud_financiera_id, cancelacion_id)
          VALUES ($1::bigint, $2::bigint)
          `,
          [solicitudFinancieraId, cancelacion.id],
        );
      }

      // Registrar el incidente para revisión administrativa. No se confirma
      // automáticamente ni se aplica una sanción desde el rol del trabajador.
      const descripcion = `Cancelación atribuible al trabajador (CU-15). Motivo declarado: ${motivo}`;
      const { rows: [incidente] } = await cliente.query<{ id: string }>(
        `
        INSERT INTO arreglalo.incidente
          (reserva_id, descripcion, registrado_por_id)
        VALUES ($1::bigint, $2::text, $3::bigint)
        RETURNING incidente_id::text AS id
        `,
        [reservaId, descripcion, trabajadorId],
      );
      if (!incidente) {
        throw new Error('PostgreSQL no devolvio el incidente registrado.');
      }

      await cliente.query(
        `
        INSERT INTO arreglalo.incidente_usuario (incidente_id, usuario_id, participacion)
        SELECT $1::bigint, vc.cliente_id,
               CASE WHEN vc.cliente_id = vc.trabajador_id
                    THEN 'cliente_y_trabajador' ELSE 'cliente' END
        FROM arreglalo.v_contratacion vc
        WHERE vc.reserva_id = $2::bigint
        UNION ALL
        SELECT $1::bigint, vc.trabajador_id, 'trabajador'
        FROM arreglalo.v_contratacion vc
        WHERE vc.reserva_id = $2::bigint
          AND vc.trabajador_id <> vc.cliente_id
        `,
        [incidente.id, reservaId],
      );

      // Este evento complementa el trigger que actualiza el estado de la reserva.
      await cliente.query(
        `
        INSERT INTO arreglalo.evento_reserva
          (reserva_id, actor_id, accion, motivo, estado_anterior, estado_nuevo)
        VALUES ($1::bigint, $2::bigint, 'cancelacion_trabajador', $3::text, $4::text, 'cancelada')
        `,
        [reservaId, trabajadorId, motivo, contexto.estado],
      );

      // Leemos la deuda creada por el trigger para responder con el dato realmente persistido.
      const { rows: [deuda] } = await cliente.query<{ centavos: string }>(
        `
        SELECT ROUND(COALESCE(SUM(mf.importe_ejecutado::numeric), 0) * 100)::text AS centavos
        FROM arreglalo.deuda_trabajador dt
        JOIN arreglalo.movimiento_financiero mf
          ON mf.movimiento_id = dt.movimiento_desembolso_id
        JOIN arreglalo.solicitud_financiera sf USING (solicitud_financiera_id)
        WHERE sf.reserva_id = $1::bigint
          AND sf.tipo = 'desembolso'
          AND mf.estado = 'confirmado'
        `,
        [reservaId],
      );
      const desembolsosPreviosCentavos = leerCentavos(deuda?.centavos ?? '0');
      if (desembolsosPreviosCentavos !== vistaPrevia.desembolsosPreviosCentavos) {
        throw new Error('La vista previa cambio. Consulta el resultado antes de confirmar.');
      }

      await cliente.query('COMMIT');

      return {
        reservaId,
        cancelacionId: cancelacion.id,
        incidenteId: incidente.id,
        solicitudFinancieraId,
        estadoAnterior: contexto.estado,
        estadoNuevo: 'cancelada',
        reembolsoCentavos,
        desembolsosPreviosCentavos,
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

  private async consultarContextoBloqueado(
    cliente: PoolClient,
    reservaId: string,
    trabajadorId: string,
  ): Promise<ContextoCancelacionTrabajador | null> {
    const { rows: [fila] } = await cliente.query<FilaContexto>(
      `${SQL_CONTEXTO.trim()} FOR UPDATE OF r`,
      [reservaId, trabajadorId],
    );
    return fila ? mapearContexto(fila) : null;
  }
}
