import type { Pool, PoolClient } from 'pg';
import type { CausalReclamo, EstadoReclamo } from '../../CORE/gestion-reclamos/gestion-reclamos';
import type { GestionReclamosRepository, DecisionAdministrativaReclamo, DeclaracionAsistenciaReclamo, DetalleReclamo, OperacionReclamo, ReclamoResumen, CancelacionReclamo } from '../../CORE/gestion-reclamos/gestion-reclamos.repository';

function centavosSeguros(valor: string | null): number | null { if (valor === null) return null; const numero=Number(valor); if(!/^\d+$/.test(valor) || !Number.isSafeInteger(numero)) throw new Error('PostgreSQL devolvió un importe inválido en centavos.'); return numero; }
async function comprobarAdministrador(cliente: Pool | PoolClient, actorId: string): Promise<void> {
  const { rows: [fila] } = await cliente.query<{ autorizado: boolean }>('SELECT arreglalo.es_administrador($1::bigint) IS TRUE AS autorizado', [actorId]);
  if (!fila?.autorizado) throw new Error('Se requiere un administrador activo.');
}
async function revertir(cliente: PoolClient): Promise<boolean> { try { await cliente.query('ROLLBACK'); return false; } catch { return true; } }

export class PostgresGestionReclamosRepository implements GestionReclamosRepository {
  constructor(private readonly pool: Pool) {}

  async listarReclamos(actorId: string, estado: EstadoReclamo): Promise<ReclamoResumen[]> {
    await comprobarAdministrador(this.pool, actorId);
    const { rows } = await this.pool.query<ReclamoResumen>(
      `
      SELECT r.reclamo_id::text AS "reclamoId",
             r.reserva_id::text AS "reservaId",
             r.reportante_id::text AS "reportanteId",
             COALESCE(pr.nombre, 'Usuario #' || r.reportante_id::text) AS "reportanteNombre",
             r.descripcion,
             r.estado,
             r.presentado_en AS "presentadoEn",
             vc.cliente_id::text AS "clienteId",
             COALESCE(pc.nombre, 'Usuario #' || vc.cliente_id::text) AS "clienteNombre",
             vc.trabajador_id::text AS "trabajadorId",
             COALESCE(pt.nombre, 'Trabajador #' || vc.trabajador_id::text) AS "trabajadorNombre",
             vc.inicio_programado AS "inicioProgramado",
             vc.estado AS "reservaEstado",
             (SELECT count(*)::integer
              FROM arreglalo.reclamo_operacion ro
              WHERE ro.reclamo_id = r.reclamo_id) AS "operacionesVinculadas"
      FROM arreglalo.reclamo r
      JOIN arreglalo.v_contratacion vc USING (reserva_id)
      LEFT JOIN arreglalo.perfil_usuario pr ON pr.usuario_id = r.reportante_id
      LEFT JOIN arreglalo.perfil_usuario pc ON pc.usuario_id = vc.cliente_id
      LEFT JOIN arreglalo.perfil_usuario pt ON pt.usuario_id = vc.trabajador_id
      WHERE ($1::text = 'todos' OR r.estado = $1::text)
      ORDER BY CASE r.estado WHEN 'abierto' THEN 0 WHEN 'en_revision' THEN 1 ELSE 2 END,
               r.presentado_en ASC, r.reclamo_id ASC
      `,
      [estado],
    );
    return rows;
  }

  async consultarReclamo(actorId: string, reclamoId: string): Promise<DetalleReclamo | null> {
    await comprobarAdministrador(this.pool, actorId);
    const { rows: [base] } = await this.pool.query<ReclamoResumen>(
      `
      SELECT r.reclamo_id::text AS "reclamoId",
             r.reserva_id::text AS "reservaId",
             r.reportante_id::text AS "reportanteId",
             COALESCE(pr.nombre, 'Usuario #' || r.reportante_id::text) AS "reportanteNombre",
             r.descripcion, r.estado, r.presentado_en AS "presentadoEn",
             vc.cliente_id::text AS "clienteId",
             COALESCE(pc.nombre, 'Usuario #' || vc.cliente_id::text) AS "clienteNombre",
             vc.trabajador_id::text AS "trabajadorId",
             COALESCE(pt.nombre, 'Trabajador #' || vc.trabajador_id::text) AS "trabajadorNombre",
             vc.inicio_programado AS "inicioProgramado",
             vc.estado AS "reservaEstado",
             (SELECT count(*)::integer FROM arreglalo.reclamo_operacion ro
              WHERE ro.reclamo_id = r.reclamo_id) AS "operacionesVinculadas"
      FROM arreglalo.reclamo r
      JOIN arreglalo.v_contratacion vc USING (reserva_id)
      LEFT JOIN arreglalo.perfil_usuario pr ON pr.usuario_id = r.reportante_id
      LEFT JOIN arreglalo.perfil_usuario pc ON pc.usuario_id = vc.cliente_id
      LEFT JOIN arreglalo.perfil_usuario pt ON pt.usuario_id = vc.trabajador_id
      WHERE r.reclamo_id = $1::bigint
      `,
      [reclamoId],
    );
    if (!base) return null;

    const [declaraciones, cancelaciones, operaciones, decisiones] = await Promise.all([
      this.pool.query<DeclaracionAsistenciaReclamo>(
        `SELECT da.asistencia_id::text AS "asistenciaId",
                da.declarada_en AS "declaradaEn",
                respuesta.respuesta,
                respuesta.respondida_en AS "respondidaEn"
         FROM arreglalo.declaracion_asistencia da
         LEFT JOIN LATERAL (
           SELECT ra.respuesta, ra.respondida_en
           FROM arreglalo.respuesta_asistencia ra
           WHERE ra.asistencia_id = da.asistencia_id
           ORDER BY ra.respondida_en DESC
           LIMIT 1
         ) respuesta ON true
         WHERE da.reserva_id = $1::bigint
         ORDER BY da.declarada_en DESC`,
        [base.reservaId],
      ),
      this.pool.query<CancelacionReclamo>(
        `SELECT cancelacion_id::text AS "cancelacionId",
                actor_id::text AS "actorId", causal_declarada AS "causalDeclarada",
                motivo, solicitada_en AS "solicitadaEn"
         FROM arreglalo.cancelacion
         WHERE reserva_id = $1::bigint
         ORDER BY solicitada_en DESC`,
        [base.reservaId],
      ),
      this.pool.query<{
        solicitudFinancieraId: string;
        tipo: string;
        importeSolicitadoCentavos: string;
        solicitanteId: string;
        solicitanteNombre: string;
        solicitadaEn: Date;
        decision: string | null;
        importeAutorizadoCentavos: string | null;
        compromisoAbierto: boolean;
        vinculada: boolean;
        movimientos: Array<{
          movimientoId: string;
          estado: string;
          importeEjecutadoCentavos: string;
          iniciadoEn: Date;
          confirmadoEn: Date | null;
        }>;
      }>(
        `SELECT sf.solicitud_financiera_id::text AS "solicitudFinancieraId",
                sf.tipo,
                (sf.importe_solicitado::numeric * 100)::bigint::text AS "importeSolicitadoCentavos",
                sf.solicitante_id::text AS "solicitanteId",
                COALESCE(p.nombre, 'Usuario #' || sf.solicitante_id::text) AS "solicitanteNombre",
                sf.solicitada_en AS "solicitadaEn",
                df.decision,
                CASE WHEN df.importe_autorizado IS NULL THEN NULL
                     ELSE (df.importe_autorizado::numeric * 100)::bigint::text END AS "importeAutorizadoCentavos",
                COALESCE(cf.cerrado_en IS NULL AND cf.compromiso_id IS NOT NULL, false) AS "compromisoAbierto",
                EXISTS (SELECT 1 FROM arreglalo.reclamo_operacion ro
                        WHERE ro.reclamo_id = $1::bigint
                          AND ro.solicitud_financiera_id = sf.solicitud_financiera_id) AS vinculada,
                COALESCE((
                  SELECT jsonb_agg(jsonb_build_object(
                    'movimientoId', m.movimiento_id::text,
                    'estado', m.estado,
                    'importeEjecutadoCentavos', (m.importe_ejecutado::numeric * 100)::bigint::text,
                    'iniciadoEn', m.iniciado_en,
                    'confirmadoEn', m.confirmado_en
                  ) ORDER BY m.iniciado_en DESC)
                  FROM arreglalo.movimiento_financiero m
                  WHERE m.solicitud_financiera_id = sf.solicitud_financiera_id
                ), '[]'::jsonb) AS movimientos
         FROM arreglalo.solicitud_financiera sf
         LEFT JOIN arreglalo.perfil_usuario p ON p.usuario_id = sf.solicitante_id
         LEFT JOIN arreglalo.decision_financiera df USING (solicitud_financiera_id)
         LEFT JOIN arreglalo.compromiso_fondo cf USING (decision_financiera_id)
         WHERE sf.reserva_id = $2::bigint
         ORDER BY sf.solicitada_en DESC`,
        [reclamoId, base.reservaId],
      ),
      this.pool.query<DecisionAdministrativaReclamo>(
        `SELECT da.decision_id::text AS "decisionId", da.causal, da.resolucion,
                da.decidida_en AS "decididaEn", da.responsable_id::text AS "responsableId",
                COALESCE(p.nombre, 'Administrador #' || da.responsable_id::text) AS "responsableNombre"
         FROM arreglalo.decision_administrativa da
         LEFT JOIN arreglalo.perfil_usuario p ON p.usuario_id = da.responsable_id
         WHERE da.reclamo_id = $1::bigint
         ORDER BY da.decidida_en DESC, da.decision_id DESC
         LIMIT 1`,
        [reclamoId],
      ),
    ]);

    const convertirOperaciones: OperacionReclamo[] = operaciones.rows.map((fila) => ({
      ...fila,
      importeSolicitadoCentavos: centavosSeguros(fila.importeSolicitadoCentavos) || 0,
      importeAutorizadoCentavos: centavosSeguros(fila.importeAutorizadoCentavos),
      movimientos: fila.movimientos.map((movimiento) => ({
        ...movimiento,
        importeEjecutadoCentavos: centavosSeguros(movimiento.importeEjecutadoCentavos) || 0,
      })),
    }));

    return {
      ...base,
      declaraciones: declaraciones.rows,
      cancelaciones: cancelaciones.rows,
      operaciones: convertirOperaciones,
      decision: decisiones.rows[0] || null,
    };
  }

  async iniciarRevisionReclamo(
    actorId: string,
    reclamoId: string,
  ): Promise<{ reclamoId: string; estado: 'en_revision' }> {
    const cliente = await this.pool.connect();
    let descartar = false;
    try {
      await cliente.query('BEGIN');
      await comprobarAdministrador(cliente, actorId);
      const { rows: [reclamo] } = await cliente.query<{ estado: string }>(
        `SELECT estado FROM arreglalo.reclamo WHERE reclamo_id = $1::bigint FOR UPDATE`,
        [reclamoId],
      );
      if (!reclamo) throw new Error('No se encontró el reclamo.');
      if (reclamo.estado === 'resuelto') throw new Error('El reclamo ya fue resuelto.');
      if (reclamo.estado === 'abierto') {
        await cliente.query(
          `UPDATE arreglalo.reclamo SET estado = 'en_revision'
           WHERE reclamo_id = $1::bigint`,
          [reclamoId],
        );
      }
      await cliente.query('COMMIT');
      return { reclamoId, estado: 'en_revision' };
    } catch (error) {
      descartar = await revertir(cliente);
      throw error;
    } finally {
      cliente.release(descartar);
    }
  }

  async vincularOperacionReclamo(
    actorId: string,
    reclamoId: string,
    solicitudFinancieraId: string,
  ): Promise<{ reclamoId: string; solicitudFinancieraId: string; vinculada: true }> {
    const cliente = await this.pool.connect();
    let descartar = false;
    try {
      await cliente.query('BEGIN');
      await comprobarAdministrador(cliente, actorId);
      const { rows: [reclamo] } = await cliente.query<{ reservaId: string; estado: string }>(
        `SELECT reserva_id::text AS "reservaId", estado
         FROM arreglalo.reclamo WHERE reclamo_id = $1::bigint FOR UPDATE`,
        [reclamoId],
      );
      if (!reclamo) throw new Error('No se encontró el reclamo.');
      if (reclamo.estado === 'resuelto') throw new Error('No se pueden vincular operaciones a un reclamo resuelto.');
      const { rows: [operacion] } = await cliente.query<{ id: string }>(
        `SELECT solicitud_financiera_id::text AS id
         FROM arreglalo.solicitud_financiera
         WHERE solicitud_financiera_id = $1::bigint
           AND reserva_id = $2::bigint
         FOR UPDATE`,
        [solicitudFinancieraId, reclamo.reservaId],
      );
      if (!operacion) throw new Error('La operación financiera no pertenece a la reserva del reclamo.');
      if (reclamo.estado === 'abierto') {
        await cliente.query(
          `UPDATE arreglalo.reclamo SET estado = 'en_revision' WHERE reclamo_id = $1::bigint`,
          [reclamoId],
        );
      }
      await cliente.query(
        `INSERT INTO arreglalo.reclamo_operacion (reclamo_id, solicitud_financiera_id)
         VALUES ($1::bigint, $2::bigint)
         ON CONFLICT (reclamo_id, solicitud_financiera_id) DO NOTHING`,
        [reclamoId, solicitudFinancieraId],
      );
      await cliente.query('COMMIT');
      return { reclamoId, solicitudFinancieraId, vinculada: true };
    } catch (error) {
      descartar = await revertir(cliente);
      throw error;
    } finally {
      cliente.release(descartar);
    }
  }

  async resolverReclamo(
    actorId: string,
    reclamoId: string,
    causal: CausalReclamo,
    resolucion: string,
  ): Promise<DecisionAdministrativaReclamo> {
    const cliente = await this.pool.connect();
    let descartar = false;
    try {
      await cliente.query('BEGIN');
      await comprobarAdministrador(cliente, actorId);
      const { rows: [reclamo] } = await cliente.query<{ estado: string }>(
        `SELECT estado FROM arreglalo.reclamo WHERE reclamo_id = $1::bigint FOR UPDATE`,
        [reclamoId],
      );
      if (!reclamo) throw new Error('No se encontró el reclamo.');
      if (reclamo.estado === 'resuelto') throw new Error('El reclamo ya fue resuelto.');
      const { rows: [anterior] } = await cliente.query<{ existe: boolean }>(
        `SELECT EXISTS (SELECT 1 FROM arreglalo.decision_administrativa
                        WHERE reclamo_id = $1::bigint) AS existe`,
        [reclamoId],
      );
      if (anterior.existe) throw new Error('El reclamo ya tiene una decisión administrativa registrada.');

      const { rows: [fila] } = await cliente.query<DecisionAdministrativaReclamo>(
        `INSERT INTO arreglalo.decision_administrativa
           (reclamo_id, responsable_id, causal, resolucion)
         VALUES ($1::bigint, $2::bigint, $3, $4)
         RETURNING decision_id::text AS "decisionId", causal, resolucion,
                   decidida_en AS "decididaEn", responsable_id::text AS "responsableId",
                   (SELECT nombre FROM arreglalo.perfil_usuario WHERE usuario_id = $2::bigint)
                     AS "responsableNombre"`,
        [reclamoId, actorId, causal, resolucion],
      );
      if (!fila) throw new Error('PostgreSQL no devolvió la decisión administrativa.');
      await cliente.query(
        `UPDATE arreglalo.reclamo SET estado = 'resuelto' WHERE reclamo_id = $1::bigint`,
        [reclamoId],
      );
      await cliente.query('COMMIT');
      return fila;
    } catch (error) {
      descartar = await revertir(cliente);
      throw error;
    } finally {
      cliente.release(descartar);
    }
  }
}
