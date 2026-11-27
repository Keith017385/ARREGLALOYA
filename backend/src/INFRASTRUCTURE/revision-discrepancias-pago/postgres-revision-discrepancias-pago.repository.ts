import type { Pool } from 'pg';
import type {
  PagoEnDisputa,
  RevisionDiscrepanciasPagoRepository,
  ResolucionPagoRegistrada,
} from '../../CORE/revision-discrepancias-pago/revision-discrepancias-pago.repository';

import type { DatosResolucionPago } from '../../CORE/revision-discrepancias-pago/resolucion-discrepancia-pago';

export class PostgresRevisionDiscrepanciasPagoRepository
  implements RevisionDiscrepanciasPagoRepository {
  constructor(private readonly pool: Pool) {}

  async resolver(
    pagoId: string,
    actorId: string,
    datos: DatosResolucionPago,
  ): Promise<ResolucionPagoRegistrada> {
    const cliente = await this.pool.connect();
    let descartarConexion = false;

    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');

      const { rows: [permiso] } = await cliente.query<{ autorizado: boolean }>(
        'SELECT arreglalo.es_administrador($1::bigint) AS autorizado',
        [actorId],
      );
      if (permiso.autorizado !== true) {
        throw new Error('Se requiere un administrador activo.');
      }

      // Usa el mismo orden de bloqueo por reserva que el CU-08.
      const { rowCount: reservas } = await cliente.query(
        `
        SELECT r.reserva_id
        FROM arreglalo.reserva r
        JOIN arreglalo.pago_directo p ON p.reserva_id = r.reserva_id
        WHERE p.pago_directo_id = $1::bigint
        FOR UPDATE OF r
        `,
        [pagoId],
      );
      if (reservas === 0) {
        throw new Error('No se encontro el pago directo.');
      }

      const { rows: [pago] } = await cliente.query<{
        confirmadoEn: Date | null;
        tieneDiscrepancia: boolean;
        yaResuelto: boolean;
        puedeAcreditarse: boolean;
      }>(
        `
        SELECT p.confirmado_en AS "confirmadoEn",
               EXISTS (
                 SELECT 1 FROM arreglalo.discrepancia_pago_directo d
                 WHERE d.pago_directo_id = p.pago_directo_id
               ) OR (p.importe_declarado::numeric <> f.saldo_directo) IS TRUE AS "tieneDiscrepancia",
               EXISTS (
                 SELECT 1 FROM arreglalo.resolucion_discrepancia_pago r
                 WHERE r.pago_directo_id = p.pago_directo_id
               ) AS "yaResuelto",
               (
                 vc.estado = 'finalizada'
                 AND f.saldo_directo = p.importe_declarado::numeric
                 AND NOT EXISTS (
                   SELECT 1
                   FROM arreglalo.modificacion_precio m
                   WHERE m.reserva_id = p.reserva_id
                     AND NOT EXISTS (
                       SELECT 1 FROM arreglalo.decision_modificacion dm
                       WHERE dm.modificacion_id = m.modificacion_id
                     )
                 )
               ) IS TRUE AS "puedeAcreditarse"
        FROM arreglalo.pago_directo p
        JOIN arreglalo.v_contratacion vc ON vc.reserva_id = p.reserva_id
        LEFT JOIN arreglalo.v_fondo f ON f.reserva_id = p.reserva_id
        WHERE p.pago_directo_id = $1::bigint
        FOR UPDATE OF p
        `,
        [pagoId],
      );

      if (!pago) {
        throw new Error('No se encontro el pago directo.');
      }
      if (pago.yaResuelto) {
        throw new Error('El pago ya tiene una resolucion.');
      }
      if (pago.confirmadoEn !== null || !pago.tieneDiscrepancia) {
        throw new Error('El pago no tiene una discrepancia pendiente de resolucion.');
      }
      if (datos.resultado === 'pago_acreditado' && !pago.puedeAcreditarse) {
        throw new Error('El importe declarado no se puede acreditar con el estado y saldo vigentes.');
      }

      const { rows: [resolucion] } = await cliente.query<
        Omit<ResolucionPagoRegistrada, 'confirmadoEn'>
      >(
        `
        INSERT INTO arreglalo.resolucion_discrepancia_pago
          (pago_directo_id, responsable_id, resultado, motivo)
        VALUES ($1::bigint, $2::bigint, $3, $4)
        ON CONFLICT (pago_directo_id) DO NOTHING
        RETURNING resolucion_id::text AS id,
                  pago_directo_id::text AS "pagoId",
                  responsable_id::text AS "responsableId",
                  resultado,
                  motivo,
                  resuelta_en AS "resueltaEn"
        `,
        [pagoId, actorId, datos.resultado, datos.motivo],
      );
      if (!resolucion) {
        throw new Error('El pago ya tiene una resolucion.');
      }

      let confirmadoEn: Date | null = null;
      if (datos.resultado === 'pago_acreditado') {
        const { rows: [confirmado] } = await cliente.query<{ confirmadoEn: Date }>(
          `
          UPDATE arreglalo.pago_directo
          SET confirmado_en = (
            SELECT resuelta_en
            FROM arreglalo.resolucion_discrepancia_pago
            WHERE resolucion_id = $2::bigint
          )
          WHERE pago_directo_id = $1::bigint AND confirmado_en IS NULL
          RETURNING confirmado_en AS "confirmadoEn"
          `,
          [pagoId, resolucion.id],
        );
        if (!confirmado) {
          throw new Error('El pago ya no esta disponible para confirmacion.');
        }
        confirmadoEn = confirmado.confirmadoEn;
      }

      await cliente.query('COMMIT');
      return { ...resolucion, confirmadoEn };
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

  async listarPendientes(actorId: string): Promise<PagoEnDisputa[] | null> {
    const { rows } = await this.pool.query<PagoEnDisputa | { pagoId: null }>(
      `
      SELECT caso.*
      FROM (SELECT arreglalo.es_administrador($1::bigint) AS autorizado) permiso
      LEFT JOIN LATERAL (
        SELECT p.pago_directo_id::text AS "pagoId",
               p.reserva_id::text AS "reservaId",
               s.descripcion AS servicio,
               p.importe_declarado::numeric::text AS "importeDeclarado",
               f.saldo_directo::text AS "importeEsperado",
               (p.importe_declarado::numeric - f.saldo_directo)::text AS diferencia,
               CASE WHEN p.importe_declarado::numeric <> f.saldo_directo
                 THEN p.declarado_en ELSE d.pendiente_desde END AS "pendienteDesde",
               COALESCE(d.declaraciones, '[]'::jsonb) AS declaraciones
        FROM arreglalo.pago_directo p
        JOIN arreglalo.v_contratacion vc ON vc.reserva_id = p.reserva_id
        JOIN arreglalo.solicitud s ON s.solicitud_id = vc.solicitud_id
        LEFT JOIN arreglalo.v_fondo f ON f.reserva_id = p.reserva_id
        LEFT JOIN LATERAL (
          SELECT min(dp.solicitada_en) AS pendiente_desde,
                 jsonb_agg(
                   jsonb_build_object(
                     'id', dp.discrepancia_id::text,
                     'solicitanteId', dp.solicitante_id::text,
                     'declaracion', dp.declaracion,
                     'importeReportado', dp.importe_reportado::text,
                     'solicitadaEn', dp.solicitada_en
                   )
                   ORDER BY dp.solicitada_en, dp.discrepancia_id
                 ) AS declaraciones
          FROM arreglalo.discrepancia_pago_directo dp
          WHERE dp.pago_directo_id = p.pago_directo_id
        ) d ON true
        WHERE permiso.autorizado IS TRUE
          AND p.confirmado_en IS NULL
          AND (d.pendiente_desde IS NOT NULL OR p.importe_declarado::numeric <> f.saldo_directo)
          AND NOT EXISTS (
            SELECT 1
            FROM arreglalo.resolucion_discrepancia_pago r
            WHERE r.pago_directo_id = p.pago_directo_id
          )
        ORDER BY "pendienteDesde", p.pago_directo_id
        LIMIT 50
      ) caso ON true
      WHERE permiso.autorizado IS TRUE
      ORDER BY caso."pendienteDesde", caso."pagoId"::bigint
      `,
      [actorId],
    );

    if (rows.length === 0) {
      return null;
    }

    return rows.filter((fila): fila is PagoEnDisputa => fila.pagoId !== null);
  }
}
