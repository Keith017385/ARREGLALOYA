import { randomUUID } from 'node:crypto';
import type { Pool, PoolClient } from 'pg';
import type {
  AnticipoPendiente,
  AnticipoRepository,
  ComprobanteAnticipo,
  DatosPagoAnticipo,
  ProcesoAnticipo,
} from '../CORE/anticipo.repository';

async function comprobarAdministrador(conexion: Pool | PoolClient, actorId: string): Promise<void> {
  const { rows: [fila] } = await conexion.query<{ autorizado: boolean }>(
    'SELECT arreglalo.es_administrador($1::bigint) IS TRUE AS autorizado',
    [actorId],
  );
  if (!fila?.autorizado) throw new Error('Se requiere un administrador activo.');
}

async function revertir(conexion: PoolClient): Promise<boolean> {
  try { await conexion.query('ROLLBACK'); return false; } catch { return true; }
}

export class PostgresAnticipoRepository implements AnticipoRepository {
  constructor(private readonly pool: Pool) {}

  async consultar(reservaId: string, actorId: string): Promise<ProcesoAnticipo | null> {
    const { rows: [fila] } = await this.pool.query<ProcesoAnticipo>(
      `
      SELECT vc.reserva_id::text AS "reservaId",
             vc.estado AS "estadoReserva",
             sf.importe_solicitado::numeric::text AS importe,
             EXISTS (
               SELECT 1 FROM arreglalo.movimiento_financiero m
               WHERE m.solicitud_financiera_id = sf.solicitud_financiera_id
                 AND m.estado = 'confirmado'
             ) AS "pagoAcreditado",
             CASE WHEN da.declaracion_id IS NULL THEN NULL ELSE jsonb_build_object(
               'id', da.declaracion_id::text,
               'estado', da.estado,
               'referencia', da.referencia,
               'fechaTransferencia', da.fecha_transferencia,
               'solicitadaEn', da.solicitada_en,
               'motivoRevision', da.motivo_revision
             ) END AS declaracion
      FROM arreglalo.solicitud_financiera sf
      JOIN arreglalo.v_contratacion vc USING (reserva_id)
      LEFT JOIN LATERAL (
        SELECT d.declaracion_id, d.estado, d.referencia, d.fecha_transferencia,
               d.solicitada_en, d.motivo_revision
        FROM arreglalo.declaracion_anticipo d
        WHERE d.solicitud_financiera_id = sf.solicitud_financiera_id
        ORDER BY d.solicitada_en DESC, d.declaracion_id DESC
        LIMIT 1
      ) da ON TRUE
      WHERE sf.reserva_id = $1::bigint
        AND sf.tipo = 'anticipo'
        AND vc.cliente_id = $2::bigint
      ORDER BY sf.solicitud_financiera_id DESC
      LIMIT 1
      `,
      [reservaId, actorId],
    );
    return fila ?? null;
  }

  async listarPropias(actorId: string): Promise<ProcesoAnticipo[]> {
    const { rows } = await this.pool.query<ProcesoAnticipo>(
      `
      SELECT vc.reserva_id::text AS "reservaId",
             vc.estado AS "estadoReserva",
             sf.importe_solicitado::numeric::text AS importe,
             EXISTS (
               SELECT 1 FROM arreglalo.movimiento_financiero m
               WHERE m.solicitud_financiera_id = sf.solicitud_financiera_id
                 AND m.estado = 'confirmado'
             ) AS "pagoAcreditado",
             CASE WHEN da.declaracion_id IS NULL THEN NULL ELSE jsonb_build_object(
               'id', da.declaracion_id::text,
               'estado', da.estado,
               'referencia', da.referencia,
               'fechaTransferencia', da.fecha_transferencia,
               'solicitadaEn', da.solicitada_en,
               'motivoRevision', da.motivo_revision
             ) END AS declaracion
      FROM arreglalo.solicitud_financiera sf
      JOIN arreglalo.v_contratacion vc USING (reserva_id)
      LEFT JOIN LATERAL (
        SELECT d.declaracion_id, d.estado, d.referencia, d.fecha_transferencia,
               d.solicitada_en, d.motivo_revision
        FROM arreglalo.declaracion_anticipo d
        WHERE d.solicitud_financiera_id = sf.solicitud_financiera_id
        ORDER BY d.solicitada_en DESC, d.declaracion_id DESC
        LIMIT 1
      ) da ON TRUE
      WHERE sf.tipo = 'anticipo' AND vc.cliente_id = $1::bigint
      ORDER BY sf.solicitada_en DESC, sf.solicitud_financiera_id DESC
      `,
      [actorId],
    );
    return rows;
  }

  async declarar(reservaId: string, actorId: string, datos: DatosPagoAnticipo): Promise<ProcesoAnticipo> {
    const cliente = await this.pool.connect();
    let descartar = false;
    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      const { rows: [financiera] } = await cliente.query<{
        solicitudId: string;
        importe: string;
        estadoReserva: string;
      }>(
        `
        SELECT sf.solicitud_financiera_id::text AS "solicitudId",
               sf.importe_solicitado::numeric::text AS importe,
               vc.estado AS "estadoReserva"
        FROM arreglalo.solicitud_financiera sf
        JOIN arreglalo.v_contratacion vc USING (reserva_id)
        WHERE sf.reserva_id = $1::bigint
          AND sf.tipo = 'anticipo'
          AND vc.cliente_id = $2::bigint
        ORDER BY sf.solicitud_financiera_id DESC
        LIMIT 1
        FOR UPDATE OF sf
        `,
        [reservaId, actorId],
      );
      if (!financiera) throw new Error('No se encontró el anticipo de esta reserva.');
      if (financiera.estadoReserva !== 'pendiente_anticipo') {
        throw new Error('La reserva ya no está esperando el anticipo. Actualiza el proceso para ver su estado.');
      }

      const { rowCount: pendientes } = await cliente.query(
        `SELECT 1 FROM arreglalo.declaracion_anticipo
         WHERE solicitud_financiera_id = $1::bigint AND estado = 'pendiente'`,
        [financiera.solicitudId],
      );
      if (pendientes) throw new Error('Ya existe un comprobante pendiente de revisión para este anticipo.');

      const movimiento = await cliente.query<{ id: string }>(
        `
        INSERT INTO arreglalo.movimiento_financiero (
          solicitud_financiera_id, clave_ejecucion, importe_ejecutado,
          estado, referencia_externa
        )
        VALUES ($1::bigint, $2, $3::numeric, 'iniciado', $4)
        RETURNING movimiento_id::text AS id
        `,
        [financiera.solicitudId, `transferencia-anticipo-${randomUUID()}`, financiera.importe, datos.referencia],
      );
      const movimientoId = movimiento.rows[0]?.id;
      if (!movimientoId) throw new Error('PostgreSQL no devolvió el movimiento de anticipo.');

      await cliente.query(
        `
        INSERT INTO arreglalo.declaracion_anticipo (
          solicitud_financiera_id, movimiento_id, cliente_id, referencia,
          fecha_transferencia, comprobante_nombre, comprobante_mime, comprobante
        )
        VALUES ($1::bigint, $2::bigint, $3::bigint, $4, $5,
                $6, $7, $8)
        `,
        [
          financiera.solicitudId,
          movimientoId,
          actorId,
          datos.referencia,
          datos.fechaTransferencia,
          datos.comprobante?.nombre ?? null,
          datos.comprobante?.mime ?? null,
          datos.comprobante?.contenido ?? null,
        ],
      );

      await cliente.query('COMMIT');
      const proceso = await this.consultar(reservaId, actorId);
      if (!proceso) throw new Error('No se pudo volver a consultar la reserva.');
      return proceso;
    } catch (error) {
      descartar = await revertir(cliente);
      throw error;
    } finally {
      cliente.release(descartar);
    }
  }

  async listarPendientes(actorId: string): Promise<AnticipoPendiente[]> {
    await comprobarAdministrador(this.pool, actorId);
    const { rows } = await this.pool.query<AnticipoPendiente>(
      `
      SELECT d.declaracion_id::text AS id,
             sf.reserva_id::text AS "reservaId",
             COALESCE(p.nombre, 'Cliente #' || vc.cliente_id::text) AS cliente,
             COALESCE(s.descripcion, 'Servicio del hogar') AS servicio,
             sf.importe_solicitado::numeric::text AS importe,
             d.referencia,
             d.fecha_transferencia AS "fechaTransferencia",
             d.solicitada_en AS "solicitadaEn",
             (d.comprobante IS NOT NULL) AS "comprobanteDisponible"
      FROM arreglalo.declaracion_anticipo d
      JOIN arreglalo.solicitud_financiera sf USING (solicitud_financiera_id)
      JOIN arreglalo.v_contratacion vc USING (reserva_id)
      LEFT JOIN arreglalo.perfil_usuario p ON p.usuario_id = vc.cliente_id
      LEFT JOIN arreglalo.solicitud s ON s.solicitud_id = vc.solicitud_id
      WHERE d.estado = 'pendiente' AND sf.tipo = 'anticipo'
      ORDER BY d.solicitada_en ASC, d.declaracion_id ASC
      `,
    );
    return rows;
  }

  async obtenerComprobante(actorId: string, declaracionId: string): Promise<ComprobanteAnticipo | null> {
    await comprobarAdministrador(this.pool, actorId);
    const { rows: [fila] } = await this.pool.query<ComprobanteAnticipo>(
      `SELECT comprobante_nombre AS nombre, comprobante_mime AS mime, comprobante AS contenido
       FROM arreglalo.declaracion_anticipo
       WHERE declaracion_id = $1::bigint AND estado = 'pendiente' AND comprobante IS NOT NULL`,
      [declaracionId],
    );
    return fila ?? null;
  }

  async resolver(
    actorId: string,
    declaracionId: string,
    decision: 'acreditada' | 'rechazada',
    motivo: string,
  ): Promise<{ declaracionId: string; reservaId: string; estado: string }> {
    const cliente = await this.pool.connect();
    let descartar = false;
    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await comprobarAdministrador(cliente, actorId);
      const { rows: [declaracion] } = await cliente.query<{
        reservaId: string;
        estadoReserva: string;
        estadoDeclaracion: string;
        movimientoId: string;
        estadoMovimiento: string;
        importeSolicitado: string;
        importeEjecutado: string;
      }>(
        `
        SELECT sf.reserva_id::text AS "reservaId",
               vc.estado AS "estadoReserva",
               d.estado AS "estadoDeclaracion",
               m.movimiento_id::text AS "movimientoId",
               m.estado AS "estadoMovimiento",
               sf.importe_solicitado::numeric::text AS "importeSolicitado",
               m.importe_ejecutado::numeric::text AS "importeEjecutado"
        FROM arreglalo.declaracion_anticipo d
        JOIN arreglalo.solicitud_financiera sf USING (solicitud_financiera_id)
        JOIN arreglalo.movimiento_financiero m USING (movimiento_id)
        JOIN arreglalo.v_contratacion vc USING (reserva_id)
        WHERE d.declaracion_id = $1::bigint AND sf.tipo = 'anticipo'
        FOR UPDATE OF d, sf, m
        `,
        [declaracionId],
      );
      if (!declaracion) throw new Error('No se encontró la declaración de anticipo.');
      if (declaracion.estadoDeclaracion !== 'pendiente') {
        throw new Error('La declaración ya fue resuelta. Actualiza la bandeja.');
      }
      if (declaracion.estadoReserva !== 'pendiente_anticipo'
          || !['iniciado', 'incierto'].includes(declaracion.estadoMovimiento)
          || Number(declaracion.importeSolicitado) !== Number(declaracion.importeEjecutado)) {
        throw new Error('El anticipo cambió y ya no puede acreditarse. Actualiza la bandeja.');
      }

      if (decision === 'acreditada') {
        await cliente.query(
          `UPDATE arreglalo.movimiento_financiero
           SET estado = 'confirmado', confirmado_en = clock_timestamp()
           WHERE movimiento_id = $1::bigint`,
          [declaracion.movimientoId],
        );
      } else {
        await cliente.query(
          `UPDATE arreglalo.movimiento_financiero
           SET estado = 'fallido'
           WHERE movimiento_id = $1::bigint`,
          [declaracion.movimientoId],
        );
      }

      await cliente.query(
        `UPDATE arreglalo.declaracion_anticipo
         SET estado = $2, motivo_revision = NULLIF($3, ''), revisada_por_id = $4::bigint,
             resuelta_en = clock_timestamp()
         WHERE declaracion_id = $1::bigint`,
        [declaracionId, decision, motivo, actorId],
      );

      if (decision === 'acreditada') {
        const { rows: [reserva] } = await cliente.query<{ estado: string }>(
          'SELECT estado FROM arreglalo.v_contratacion WHERE reserva_id = $1::bigint',
          [declaracion.reservaId],
        );
        if (reserva?.estado !== 'reservada') {
          throw new Error('PostgreSQL no confirmó la reserva después de acreditar el anticipo.');
        }
      }

      await cliente.query('COMMIT');
      return { declaracionId, reservaId: declaracion.reservaId, estado: decision };
    } catch (error) {
      descartar = await revertir(cliente);
      throw error;
    } finally {
      cliente.release(descartar);
    }
  }
}
