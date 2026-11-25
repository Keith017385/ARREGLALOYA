import type { Pool, PoolClient } from 'pg';
import type { DecisionDesembolso } from '../../CORE/aprobacion-desembolsos/aprobacion-desembolsos';
import type { AprobacionDesembolsosRepository, DecisionDesembolsoRegistrada, SolicitudDesembolsoPendiente } from '../../CORE/aprobacion-desembolsos/aprobacion-desembolsos.repository';

function centavosSeguros(valor: string | null): number | null { if (valor === null) return null; const numero=Number(valor); if(!/^\d+$/.test(valor) || !Number.isSafeInteger(numero)) throw new Error('PostgreSQL devolvió un importe inválido en centavos.'); return numero; }
async function comprobarAdministrador(cliente: Pool | PoolClient, actorId: string): Promise<void> {
  const { rows: [fila] } = await cliente.query<{ autorizado: boolean }>('SELECT arreglalo.es_administrador($1::bigint) IS TRUE AS autorizado', [actorId]);
  if (!fila?.autorizado) throw new Error('Se requiere un administrador activo.');
}
async function revertir(cliente: PoolClient): Promise<boolean> { try { await cliente.query('ROLLBACK'); return false; } catch { return true; } }

export class PostgresAprobacionDesembolsosRepository implements AprobacionDesembolsosRepository {
  constructor(private readonly pool: Pool) {}

  async listarDesembolsos(actorId: string): Promise<SolicitudDesembolsoPendiente[]> {
    await comprobarAdministrador(this.pool, actorId);
    const { rows } = await this.pool.query<{
      solicitudFinancieraId: string;
      reservaId: string;
      trabajadorId: string;
      trabajadorNombre: string;
      clienteNombre: string;
      importeSolicitadoCentavos: string;
      disponibleCentavos: string;
      solicitadaEn: Date;
      reservaEstado: string;
      reclamoEnRevision: boolean;
    }>(
      `
      SELECT sf.solicitud_financiera_id::text AS "solicitudFinancieraId",
             sf.reserva_id::text AS "reservaId",
             vc.trabajador_id::text AS "trabajadorId",
             COALESCE(pt.nombre, 'Trabajador #' || vc.trabajador_id::text) AS "trabajadorNombre",
             COALESCE(pc.nombre, 'Cliente #' || vc.cliente_id::text) AS "clienteNombre",
             (sf.importe_solicitado::numeric * 100)::bigint::text AS "importeSolicitadoCentavos",
             (COALESCE(vf.disponible, 0)::numeric * 100)::bigint::text AS "disponibleCentavos",
             sf.solicitada_en AS "solicitadaEn",
             vc.estado AS "reservaEstado",
             EXISTS (
               SELECT 1 FROM arreglalo.reclamo_operacion ro
               JOIN arreglalo.reclamo r USING (reclamo_id)
               WHERE ro.solicitud_financiera_id = sf.solicitud_financiera_id
                 AND r.estado = 'en_revision'
             ) AS "reclamoEnRevision"
      FROM arreglalo.solicitud_financiera sf
      JOIN arreglalo.v_contratacion vc USING (reserva_id)
      LEFT JOIN arreglalo.perfil_usuario pt ON pt.usuario_id = vc.trabajador_id
      LEFT JOIN arreglalo.perfil_usuario pc ON pc.usuario_id = vc.cliente_id
      LEFT JOIN arreglalo.v_fondo vf USING (reserva_id)
      WHERE sf.tipo = 'desembolso'
        AND NOT EXISTS (
          SELECT 1 FROM arreglalo.decision_financiera df
          WHERE df.solicitud_financiera_id = sf.solicitud_financiera_id
        )
      ORDER BY sf.solicitada_en ASC, sf.solicitud_financiera_id ASC
      `,
    );
    return rows.map((fila) => ({
      ...fila,
      importeSolicitadoCentavos: centavosSeguros(fila.importeSolicitadoCentavos) || 0,
      disponibleCentavos: centavosSeguros(fila.disponibleCentavos) || 0,
      documentosDisponibles: false,
    }));
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
      const { rows: [solicitud] } = await cliente.query<{ reservaId: string | null; tipo: string }>(
        `SELECT reserva_id::text AS "reservaId", tipo
         FROM arreglalo.solicitud_financiera
         WHERE solicitud_financiera_id = $1::bigint
         FOR UPDATE`,
        [solicitudFinancieraId],
      );
      if (!solicitud) throw new Error('No se encontró la solicitud financiera.');
      if (solicitud.tipo !== 'desembolso') throw new Error('La solicitud no corresponde a un desembolso.');
      const { rows: [previa] } = await cliente.query<{ existe: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM arreglalo.decision_financiera
                        WHERE solicitud_financiera_id = $1::bigint) AS existe`,
        [solicitudFinancieraId],
      );
      if (previa.existe) throw new Error('La solicitud de desembolso ya fue decidida.');

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
                        ELSE (importe_autorizado::numeric * 100)::bigint::text END
                     AS "importeAutorizadoCentavos",
                   motivo, decidida_en AS "decididaEn"`,
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
      throw error;
    } finally {
      cliente.release(descartar);
    }
  }
}
