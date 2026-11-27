import type { Pool, PoolClient } from 'pg';
import type {
  ApelacionSancion,
  DecisionApelacion,
  EstadoApelacion,
  EvidenciaApelacion,
  HistorialDecisionApelacion,
  SancionPropia,
} from '../../CORE/apelacion-sancion/apelacion-sancion';
import type {
  ApelacionSancionRepository,
  CrearApelacionResultado,
  ConsultarApelacionResultado,
  ResolverApelacionResultado,
} from '../../CORE/apelacion-sancion/apelacion-sancion.repository';

type FechaSql = Date | string;

interface FilaApelacion {
  apelacionId: string;
  sancionId: string;
  solicitadaPorId: string;
  justificacion: string;
  estado: EstadoApelacion;
  solicitadaEn: FechaSql;
  evidencias: Array<Omit<EvidenciaApelacion, 'cargadaEn'> & { cargadaEn: FechaSql }> | string;
  historial: Array<Omit<HistorialDecisionApelacion, 'decididaEn'> & { decididaEn: FechaSql }> | string;
}

const SELECT_APELACIONES = `
  SELECT a.apelacion_id::text AS "apelacionId",
         a.sancion_id::text AS "sancionId",
         a.solicitada_por_id::text AS "solicitadaPorId",
         a.justificacion,
         a.estado,
         a.solicitada_en AS "solicitadaEn",
         COALESCE((
           SELECT jsonb_agg(
             jsonb_build_object(
               'evidenciaId', e.evidencia_id::text,
               'nombreArchivo', e.nombre_archivo,
               'cargadaEn', e.cargada_en
             ) ORDER BY e.evidencia_id
           )
           FROM arreglalo.evidencia_apelacion e
           WHERE e.apelacion_id = a.apelacion_id
         ), '[]'::jsonb) AS evidencias,
         COALESCE((
           SELECT jsonb_agg(
             jsonb_build_object(
               'decisionId', h.decision_id::text,
               'decision', h.decision,
               'fundamento', h.fundamento,
               'decididaPorId', h.decidida_por_id::text,
               'decididaEn', h.decidida_en
             ) ORDER BY h.decidida_en DESC, h.decision_id DESC
           )
           FROM arreglalo.historial_decision_apelacion h
           WHERE h.apelacion_id = a.apelacion_id
         ), '[]'::jsonb) AS historial
  FROM arreglalo.apelacion_sancion a
`;

function leerArray<T>(valor: T[] | string): T[] {
  return typeof valor === 'string' ? JSON.parse(valor) as T[] : valor;
}

function comoFecha(valor: FechaSql): Date {
  return valor instanceof Date ? valor : new Date(valor);
}

function convertirFila(fila: FilaApelacion): ApelacionSancion {
  const evidencias = leerArray(fila.evidencias).map((evidencia) => ({
    ...evidencia,
    cargadaEn: comoFecha(evidencia.cargadaEn),
  }));

  const historial = leerArray(fila.historial).map((decision) => ({
    ...decision,
    decididaEn: comoFecha(decision.decididaEn),
  }));

  return {
    apelacionId: fila.apelacionId,
    sancionId: fila.sancionId,
    solicitadaPorId: fila.solicitadaPorId,
    justificacion: fila.justificacion,
    estado: fila.estado,
    solicitadaEn: comoFecha(fila.solicitadaEn),
    evidencias,
    historial,
  };
}

async function revertir(cliente: PoolClient): Promise<boolean> {
  try {
    await cliente.query('ROLLBACK');
    return false;
  } catch {
    return true;
  }
}

export class PostgresApelacionSancionRepository implements ApelacionSancionRepository {
  constructor(private readonly pool: Pool) {}

  async crear(
    actorId: string,
    sancionId: string,
    justificacion: string,
    evidencias: { nombreArchivo: string; contenido: Uint8Array }[],
  ): Promise<CrearApelacionResultado> {
    const cliente = await this.pool.connect();
    let descartar = false;

    try {
      await cliente.query('BEGIN');

      const { rows: [permiso] } = await cliente.query<{ autorizado: boolean }>(
        `SELECT arreglalo.tiene_rol($1::bigint, 'trabajador') IS TRUE AS autorizado`,
        [actorId],
      );

      if (!permiso?.autorizado) {
        await cliente.query('ROLLBACK');
        return { estado: 'sin_permiso' };
      }

      const { rows: [sancion] } = await cliente.query<{ trabajadorId: string }>(
        `SELECT usuario_id::text AS "trabajadorId"
         FROM arreglalo.sancion
         WHERE sancion_id = $1::bigint
         FOR UPDATE`,
        [sancionId],
      );

      if (!sancion) {
        await cliente.query('ROLLBACK');
        return { estado: 'sancion_no_encontrada' };
      }

      if (sancion.trabajadorId !== actorId) {
        await cliente.query('ROLLBACK');
        return { estado: 'sancion_no_propia' };
      }

      const { rows: [pendiente] } = await cliente.query<{ existe: boolean }>(
        `SELECT EXISTS (
           SELECT 1
           FROM arreglalo.apelacion_sancion
           WHERE sancion_id = $1::bigint
             AND estado = 'pendiente'
         ) AS existe`,
        [sancionId],
      );

      if (pendiente?.existe) {
        await cliente.query('ROLLBACK');
        return { estado: 'ya_pendiente' };
      }

      const { rows: [nueva] } = await cliente.query<{ apelacionId: string }>(
        `INSERT INTO arreglalo.apelacion_sancion
           (sancion_id, solicitada_por_id, justificacion)
         VALUES ($1::bigint, $2::bigint, $3)
         RETURNING apelacion_id::text AS "apelacionId"`,
        [sancionId, actorId, justificacion],
      );

      if (!nueva) {
        throw new Error('PostgreSQL no devolvió la apelación creada.');
      }

      for (const evidencia of evidencias) {
        await cliente.query(
          `INSERT INTO arreglalo.evidencia_apelacion
             (apelacion_id, nombre_archivo, contenido)
           VALUES ($1::bigint, $2, $3)`,
          [nueva.apelacionId, evidencia.nombreArchivo, Buffer.from(evidencia.contenido)],
        );
      }

      const apelacion = await this.cargarDetalle(cliente, nueva.apelacionId);
      if (!apelacion) {
        throw new Error('No se pudo consultar la apelación recién creada.');
      }

      await cliente.query('COMMIT');
      return { estado: 'creada', apelacion };
    } catch (error) {
      const pgError = error as { code?: string; constraint?: string };
      descartar = await revertir(cliente);

      if (pgError.code === '23505' && pgError.constraint === 'apelacion_sancion_pendiente_uk') {
        return { estado: 'ya_pendiente' };
      }

      throw error;
    } finally {
      cliente.release(descartar);
    }
  }

  async listarPropias(actorId: string) {
    const { rows: [permiso] } = await this.pool.query<{ autorizado: boolean }>(
      `SELECT arreglalo.tiene_rol($1::bigint, 'trabajador') IS TRUE AS autorizado`,
      [actorId],
    );

    if (!permiso?.autorizado) {
      return { estado: 'sin_permiso' as const };
    }

    const { rows } = await this.pool.query<FilaApelacion>(
      `${SELECT_APELACIONES}
       WHERE a.solicitada_por_id = $1::bigint
       ORDER BY a.solicitada_en DESC, a.apelacion_id DESC`,
      [actorId],
    );

    return { estado: 'listadas' as const, apelaciones: rows.map(convertirFila) };
  }

  async listarPendientes(actorId: string) {
    const { rows: [permiso] } = await this.pool.query<{ autorizado: boolean }>(
      `SELECT arreglalo.es_administrador($1::bigint) IS TRUE AS autorizado`,
      [actorId],
    );

    if (!permiso?.autorizado) {
      return { estado: 'sin_permiso' as const };
    }

    const { rows } = await this.pool.query<FilaApelacion>(
      `${SELECT_APELACIONES}
       WHERE a.estado = 'pendiente'
       ORDER BY a.solicitada_en ASC, a.apelacion_id ASC`,
    );

    return { estado: 'listadas' as const, apelaciones: rows.map(convertirFila) };
  }

  async consultar(
    actorId: string,
    apelacionId: string,
  ): Promise<ConsultarApelacionResultado> {
    const { rows: [permiso] } = await this.pool.query<{
      trabajador: boolean;
      administrador: boolean;
    }>(
      `SELECT arreglalo.tiene_rol($1::bigint, 'trabajador') IS TRUE AS trabajador,
              arreglalo.es_administrador($1::bigint) IS TRUE AS administrador`,
      [actorId],
    );

    if (!permiso?.trabajador && !permiso?.administrador) {
      return { estado: 'sin_permiso' };
    }

    const { rows: [fila] } = await this.pool.query<FilaApelacion>(
      `${SELECT_APELACIONES}
       WHERE a.apelacion_id = $1::bigint
         AND (a.solicitada_por_id = $2::bigint
              OR arreglalo.es_administrador($2::bigint) IS TRUE)`,
      [apelacionId, actorId],
    );

    return fila
      ? { estado: 'encontrada', apelacion: convertirFila(fila) }
      : { estado: 'no_encontrada' };
  }

  async resolver(
    actorId: string,
    apelacionId: string,
    decision: DecisionApelacion,
    fundamento: string,
  ): Promise<ResolverApelacionResultado> {
    const cliente = await this.pool.connect();
    let descartar = false;

    try {
      await cliente.query('BEGIN');

      const { rows: [permiso] } = await cliente.query<{ autorizado: boolean }>(
        `SELECT arreglalo.es_administrador($1::bigint) IS TRUE AS autorizado`,
        [actorId],
      );

      if (!permiso?.autorizado) {
        await cliente.query('ROLLBACK');
        return { estado: 'sin_permiso' };
      }

      const { rows: [apelacionActual] } = await cliente.query<{ estado: EstadoApelacion }>(
        `SELECT estado
         FROM arreglalo.apelacion_sancion
         WHERE apelacion_id = $1::bigint
         FOR UPDATE`,
        [apelacionId],
      );

      if (!apelacionActual) {
        await cliente.query('ROLLBACK');
        return { estado: 'no_encontrada' };
      }

      if (apelacionActual.estado !== 'pendiente') {
        await cliente.query('ROLLBACK');
        return { estado: 'ya_resuelta' };
      }

      await cliente.query(
        `INSERT INTO arreglalo.historial_decision_apelacion
           (apelacion_id, decision, fundamento, decidida_por_id)
         VALUES ($1::bigint, $2, $3, $4::bigint)`,
        [apelacionId, decision, fundamento, actorId],
      );

      await cliente.query(
        `UPDATE arreglalo.apelacion_sancion
         SET estado = $2
         WHERE apelacion_id = $1::bigint`,
        [apelacionId, decision],
      );

      const apelacion = await this.cargarDetalle(cliente, apelacionId);
      if (!apelacion) {
        throw new Error('No se pudo consultar la apelación resuelta.');
      }

      await cliente.query('COMMIT');
      return { estado: 'resuelta', apelacion };
    } catch (error) {
      descartar = await revertir(cliente);
      throw error;
    } finally {
      cliente.release(descartar);
    }
  }
async descargarEvidencia(actorId: string, apelacionId: string, evidenciaId: string) {
  const { rows: [permiso] } = await this.pool.query<{
    trabajador: boolean;
    administrador: boolean;
  }>(
    `SELECT arreglalo.tiene_rol($1::bigint, 'trabajador') IS TRUE AS trabajador,
            arreglalo.es_administrador($1::bigint) IS TRUE AS administrador`,
    [actorId],
  );

  if (!permiso?.trabajador && !permiso?.administrador) {
    return { estado: 'sin_permiso' as const };
  }

  const { rows: [fila] } = await this.pool.query<{
    evidenciaId: string;
    nombreArchivo: string;
    contenido: Buffer;
  }>(
    `SELECT e.evidencia_id::text AS "evidenciaId",
            e.nombre_archivo AS "nombreArchivo",
            e.contenido
     FROM arreglalo.evidencia_apelacion e
     JOIN arreglalo.apelacion_sancion a
       ON a.apelacion_id = e.apelacion_id
     WHERE e.evidencia_id = $1::bigint
       AND a.apelacion_id = $2::bigint
       AND (
         a.solicitada_por_id = $3::bigint
         OR arreglalo.es_administrador($3::bigint) IS TRUE
       )`,
    [evidenciaId, apelacionId, actorId],
  );

  if (!fila) {
    return { estado: 'no_encontrada' as const };
  }

  return {
    estado: 'encontrada' as const,
    evidencia: fila,
  };
}
  private async cargarDetalle(
    cliente: PoolClient,
    apelacionId: string,
  ): Promise<ApelacionSancion | null> {
    const { rows: [fila] } = await cliente.query<FilaApelacion>(
      `${SELECT_APELACIONES}
       WHERE a.apelacion_id = $1::bigint`,
      [apelacionId],
    );

    return fila ? convertirFila(fila) : null;
  }

  async listarSancionesPropias(actorId: string) {
    const { rows: [permiso] } = await this.pool.query<{ autorizado: boolean }>(
      `SELECT arreglalo.tiene_rol($1::bigint, 'trabajador') IS TRUE AS autorizado`,
      [actorId],
    );
    if (!permiso?.autorizado) {
      return { estado: 'sin_permiso' as const };
    }
    const { rows } = await this.pool.query<SancionPropia>(
      `SELECT s.sancion_id::text AS "sancionId",
              s.motivo,
              s.inicio,
              s.fin,
              (
                SELECT a.estado
                FROM arreglalo.apelacion_sancion a
                WHERE a.sancion_id = s.sancion_id
                ORDER BY a.solicitada_en DESC, a.apelacion_id DESC
                LIMIT 1
              ) AS "estadoApelacion"
       FROM arreglalo.sancion s
       WHERE s.usuario_id = $1::bigint
       ORDER BY s.inicio DESC, s.sancion_id DESC`,
      [actorId],
    );
    return { estado: 'listadas' as const, sanciones: rows };
  }
}
