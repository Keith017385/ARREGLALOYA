import type { Pool, PoolClient } from 'pg';
import {
  calcularMaximoAutorizableCentavos,
  obtenerMotivosBloqueoTransferencia,
  validarCondicionesTransferencia,
} from '../../CORE/aprobacion-desembolsos/aprobacion-desembolsos';
import type {
  CondicionesTransferencia,
  DecisionDesembolso,
} from '../../CORE/aprobacion-desembolsos/aprobacion-desembolsos';
import type {
  AprobacionDesembolsosRepository,
  DecisionDesembolsoRegistrada,
  SolicitudDesembolsoPendiente,
} from '../../CORE/aprobacion-desembolsos/aprobacion-desembolsos.repository';

interface FilaSolicitud {
  solicitudFinancieraId: string;
  reservaId: string;
  trabajadorId: string;
  trabajadorNombre: string;
  clienteNombre: string;
  importeSolicitadoCentavos: string;
  disponibleCentavos: string;
  solicitadaEn: Date;
  reservaEstado: string;
  documentoDisponible: boolean;
  reclamoEnRevision: boolean;
  movimientoExistente: boolean;
}

interface FilaCondiciones {
  tipoSolicitud: string;
  estadoReserva: string;
  importeSolicitadoCentavos: string;
  disponibleCentavos: string;
  documentoDisponible: boolean;
  reclamoEnRevision: boolean;
  movimientoExistente: boolean;
}

function centavosSeguros(valor: string | null): number | null {
  if (valor === null) return null;
  if (!/^\d+$/.test(valor)) {
    throw new Error('PostgreSQL devolvió un importe inválido en centavos.');
  }
  const numero = Number(valor);
  if (!Number.isSafeInteger(numero)) {
    throw new Error('El importe excede el rango numérico seguro.');
  }
  return numero;
}

function condicionesDesdeFila(fila: FilaCondiciones): CondicionesTransferencia {
  const importeSolicitadoCentavos = centavosSeguros(fila.importeSolicitadoCentavos);
  const disponibleCentavos = centavosSeguros(fila.disponibleCentavos);
  if (importeSolicitadoCentavos === null || disponibleCentavos === null) {
    throw new Error('No fue posible calcular los importes de la solicitud.');
  }
  return {
    tipoSolicitud: fila.tipoSolicitud,
    estadoReserva: fila.estadoReserva,
    importeSolicitadoCentavos,
    disponibleCentavos,
    documentoDisponible: fila.documentoDisponible,
    reclamoEnRevision: fila.reclamoEnRevision,
    movimientoExistente: fila.movimientoExistente,
  };
}

async function comprobarAdministrador(cliente: Pool | PoolClient, actorId: string): Promise<void> {
  const { rows: [fila] } = await cliente.query<{ autorizado: boolean }>(
    'SELECT arreglalo.es_administrador($1::bigint) IS TRUE AS autorizado',
    [actorId],
  );
  if (!fila?.autorizado) throw new Error('Se requiere un administrador activo.');
}

async function revertir(cliente: PoolClient): Promise<boolean> {
  try {
    await cliente.query('ROLLBACK');
    return false;
  } catch {
    return true;
  }
}

function obtenerCodigoError(error: unknown): string | undefined {
  if (typeof error === 'object' && error !== null && 'code' in error) {
    const codigo = (error as { code?: unknown }).code;
    return typeof codigo === 'string' ? codigo : undefined;
  }
  return undefined;
}

export class PostgresAprobacionDesembolsosRepository implements AprobacionDesembolsosRepository {
  constructor(private readonly pool: Pool) {}

  async listarDesembolsos(actorId: string): Promise<SolicitudDesembolsoPendiente[]> {
    await comprobarAdministrador(this.pool, actorId);

    const { rows } = await this.pool.query<FilaSolicitud>(
      `
      SELECT sf.solicitud_financiera_id::text AS "solicitudFinancieraId",
             sf.reserva_id::text AS "reservaId",
             vc.trabajador_id::text AS "trabajadorId",
             COALESCE(pt.nombre, 'Trabajador #' || vc.trabajador_id::text) AS "trabajadorNombre",
             COALESCE(pc.nombre, 'Cliente #' || vc.cliente_id::text) AS "clienteNombre",
             ROUND(sf.importe_solicitado::numeric * 100)::bigint::text AS "importeSolicitadoCentavos",
             ROUND(GREATEST(
               0::numeric,
               COALESCE(vf.disponible, 0)::numeric - COALESCE(otras.importe_pendiente, 0)::numeric
             ) * 100)::bigint::text AS "disponibleCentavos",
             sf.solicitada_en AS "solicitadaEn",
             vc.estado AS "reservaEstado",
             EXISTS (
               SELECT 1
               FROM arreglalo.documento_desembolso dd
               WHERE dd.solicitud_financiera_id = sf.solicitud_financiera_id
             ) AS "documentoDisponible",
             EXISTS (
               SELECT 1
               FROM arreglalo.reclamo_operacion ro
               JOIN arreglalo.reclamo r USING (reclamo_id)
               WHERE ro.solicitud_financiera_id = sf.solicitud_financiera_id
                 AND r.estado = 'en_revision'
             ) AS "reclamoEnRevision",
             EXISTS (
               SELECT 1
               FROM arreglalo.movimiento_financiero mf
               WHERE mf.solicitud_financiera_id = sf.solicitud_financiera_id
             ) AS "movimientoExistente"
      FROM arreglalo.solicitud_financiera sf
      JOIN arreglalo.v_contratacion vc USING (reserva_id)
      LEFT JOIN arreglalo.perfil_usuario pt ON pt.usuario_id = vc.trabajador_id
      LEFT JOIN arreglalo.perfil_usuario pc ON pc.usuario_id = vc.cliente_id
      LEFT JOIN arreglalo.v_fondo vf USING (reserva_id)
      LEFT JOIN LATERAL (
        SELECT COALESCE(SUM(otra.importe_solicitado::numeric), 0) AS importe_pendiente
        FROM arreglalo.solicitud_financiera otra
        WHERE otra.reserva_id = sf.reserva_id
          AND otra.tipo = 'desembolso'
          AND otra.solicitud_financiera_id <> sf.solicitud_financiera_id
          AND NOT EXISTS (
            SELECT 1
            FROM arreglalo.decision_financiera d
            WHERE d.solicitud_financiera_id = otra.solicitud_financiera_id
          )
      ) otras ON true
      WHERE sf.tipo = 'desembolso'
        AND NOT EXISTS (
          SELECT 1
          FROM arreglalo.decision_financiera df
          WHERE df.solicitud_financiera_id = sf.solicitud_financiera_id
        )
      ORDER BY sf.solicitada_en ASC, sf.solicitud_financiera_id ASC
      `,
    );

    return rows.map((fila) => {
      const importeSolicitadoCentavos = centavosSeguros(fila.importeSolicitadoCentavos);
      const disponibleCentavos = centavosSeguros(fila.disponibleCentavos);
      if (importeSolicitadoCentavos === null || disponibleCentavos === null) {
        throw new Error('PostgreSQL devolvió importes incompletos para la solicitud.');
      }

      const condiciones: CondicionesTransferencia = {
        tipoSolicitud: 'desembolso',
        estadoReserva: fila.reservaEstado,
        importeSolicitadoCentavos,
        disponibleCentavos,
        documentoDisponible: fila.documentoDisponible,
        reclamoEnRevision: fila.reclamoEnRevision,
        movimientoExistente: fila.movimientoExistente,
      };
      const motivosBloqueo = obtenerMotivosBloqueoTransferencia(condiciones);

      return {
        ...fila,
        importeSolicitadoCentavos,
        disponibleCentavos,
        importeMaximoAutorizableCentavos: calcularMaximoAutorizableCentavos(condiciones),
        puedeAprobar: motivosBloqueo.length === 0,
        motivosBloqueo,
      };
    });
  }

  async decidirDesembolso(
    actorId: string,
    solicitudFinancieraId: string,
    decision: DecisionDesembolso,
    importeAutorizadoCentavos: number | null,
    motivo: string,
  ): Promise<DecisionDesembolsoRegistrada> {
    const cliente = await this.pool.connect();
    let descartar = false;

    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');
      await comprobarAdministrador(cliente, actorId);

      // 1. Bloquea la solicitud: dos administradores no pueden decidirla al mismo tiempo.
      const { rows: [solicitud] } = await cliente.query<{
        reservaId: string | null;
        tipo: string;
      }>(
        `SELECT reserva_id::text AS "reservaId", tipo
         FROM arreglalo.solicitud_financiera
         WHERE solicitud_financiera_id = $1::bigint
         FOR UPDATE`,
        [solicitudFinancieraId],
      );

      if (!solicitud) throw new Error('No se encontró la solicitud financiera.');
      if (solicitud.tipo !== 'desembolso') {
        throw new Error('La solicitud financiera no corresponde a un desembolso.');
      }
      if (!solicitud.reservaId) {
        throw new Error('La solicitud de desembolso no tiene una reserva asociada.');
      }

      // 2. Bloquea la reserva: serializa aprobaciones distintas que comparten el mismo fondo.
      const { rows: [reserva] } = await cliente.query<{ estado: string }>(
        `SELECT estado
         FROM arreglalo.reserva
         WHERE reserva_id = $1::bigint
         FOR UPDATE`,
        [solicitud.reservaId],
      );
      if (!reserva) throw new Error('No se encontró la reserva de la solicitud.');

      // 3. Comprueba idempotencia antes de insertar una segunda decisión.
      const { rows: [previa] } = await cliente.query<{ existe: boolean }>(
        `SELECT EXISTS (
           SELECT 1 FROM arreglalo.decision_financiera
           WHERE solicitud_financiera_id = $1::bigint
         ) AS existe`,
        [solicitudFinancieraId],
      );
      if (previa.existe) {
        throw new Error('La solicitud de desembolso ya fue decidida; no se permite una aprobación duplicada.');
      }

      // 4. Para aprobar, vuelve a leer las condiciones reales bajo los bloqueos.
      // Rechazar no requiere que se cumplan las condiciones de transferencia.
      if (decision === 'aprobada') {
        const { rows: [fila] } = await cliente.query<FilaCondiciones>(
          `
          SELECT sf.tipo AS "tipoSolicitud",
                 r.estado AS "estadoReserva",
                 ROUND(sf.importe_solicitado::numeric * 100)::bigint::text AS "importeSolicitadoCentavos",
                 ROUND(GREATEST(
                   0::numeric,
                   COALESCE(vf.disponible, 0)::numeric - COALESCE(otras.importe_pendiente, 0)::numeric
                 ) * 100)::bigint::text AS "disponibleCentavos",
                 EXISTS (
                   SELECT 1 FROM arreglalo.documento_desembolso dd
                   WHERE dd.solicitud_financiera_id = sf.solicitud_financiera_id
                 ) AS "documentoDisponible",
                 EXISTS (
                   SELECT 1
                   FROM arreglalo.reclamo_operacion ro
                   JOIN arreglalo.reclamo rec USING (reclamo_id)
                   WHERE ro.solicitud_financiera_id = sf.solicitud_financiera_id
                     AND rec.estado = 'en_revision'
                 ) AS "reclamoEnRevision",
                 EXISTS (
                   SELECT 1 FROM arreglalo.movimiento_financiero mf
                   WHERE mf.solicitud_financiera_id = sf.solicitud_financiera_id
                 ) AS "movimientoExistente"
          FROM arreglalo.solicitud_financiera sf
          JOIN arreglalo.reserva r USING (reserva_id)
          LEFT JOIN arreglalo.v_fondo vf USING (reserva_id)
          LEFT JOIN LATERAL (
            SELECT COALESCE(SUM(otra.importe_solicitado::numeric), 0) AS importe_pendiente
            FROM arreglalo.solicitud_financiera otra
            WHERE otra.reserva_id = sf.reserva_id
              AND otra.tipo = 'desembolso'
              AND otra.solicitud_financiera_id <> sf.solicitud_financiera_id
              AND NOT EXISTS (
                SELECT 1 FROM arreglalo.decision_financiera d
                WHERE d.solicitud_financiera_id = otra.solicitud_financiera_id
              )
          ) otras ON true
          WHERE sf.solicitud_financiera_id = $1::bigint
          `,
          [solicitudFinancieraId],
        );

        if (!fila) throw new Error('No se pudieron consultar las condiciones actuales de transferencia.');
        const condiciones = condicionesDesdeFila(fila);
        validarCondicionesTransferencia(condiciones, importeAutorizadoCentavos as number);
      }

      // 5. El trigger de PostgreSQL crea/valida el compromiso del fondo cuando corresponde.
      // Aquí solo se registra la decisión; no se ejecuta la transferencia bancaria.
      const { rows: [fila] } = await cliente.query<{
        decisionFinancieraId: string;
        solicitudFinancieraId: string;
        decision: DecisionDesembolso;
        importeAutorizadoCentavos: string | null;
        motivo: string;
        decididaEn: Date;
      }>(
        `INSERT INTO arreglalo.decision_financiera
           (solicitud_financiera_id, responsable_id, decision, importe_autorizado, motivo)
         VALUES ($1::bigint, $2::bigint, $3,
                 CASE WHEN $4::bigint IS NULL THEN NULL ELSE $4::numeric / 100 END,
                 $5)
         RETURNING decision_financiera_id::text AS "decisionFinancieraId",
                   solicitud_financiera_id::text AS "solicitudFinancieraId",
                   decision,
                   CASE WHEN importe_autorizado IS NULL THEN NULL
                        ELSE ROUND(importe_autorizado::numeric * 100)::bigint::text END
                     AS "importeAutorizadoCentavos",
                   motivo,
                   decidida_en AS "decididaEn"`,
        [solicitudFinancieraId, actorId, decision, importeAutorizadoCentavos, motivo],
      );

      if (!fila) throw new Error('PostgreSQL no devolvió la decisión financiera.');
      await cliente.query('COMMIT');
      return {
        ...fila,
        importeAutorizadoCentavos: centavosSeguros(fila.importeAutorizadoCentavos),
      };
    } catch (error) {
      descartar = await revertir(cliente);
      if (obtenerCodigoError(error) === '23505') {
        throw new Error('La solicitud de desembolso ya fue decidida; no se permite una aprobación duplicada.');
      }
      throw error;
    } finally {
      cliente.release(descartar);
    }
  }
}
