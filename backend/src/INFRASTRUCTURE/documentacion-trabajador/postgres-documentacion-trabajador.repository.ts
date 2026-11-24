import type { Pool, PoolClient } from 'pg';
import type { EstadoDocumento, ResultadoDocumento } from '../../CORE/documentacion-trabajador/documentacion-trabajador';
import type { DocumentoTrabajador, DocumentacionTrabajadorRepository, RevisionDocumentoRegistrada } from '../../CORE/documentacion-trabajador/documentacion-trabajador.repository';

async function comprobarAdministrador(cliente: Pool | PoolClient, actorId: string): Promise<void> {
  const { rows: [fila] } = await cliente.query<{ autorizado: boolean }>('SELECT arreglalo.es_administrador($1::bigint) IS TRUE AS autorizado', [actorId]);
  if (!fila?.autorizado) throw new Error('Se requiere un administrador activo.');
}
async function revertir(cliente: PoolClient): Promise<boolean> { try { await cliente.query('ROLLBACK'); return false; } catch { return true; } }

export class PostgresDocumentacionTrabajadorRepository implements DocumentacionTrabajadorRepository {
  constructor(private readonly pool: Pool) {}

  async listarDocumentos(actorId: string, estado: EstadoDocumento): Promise<DocumentoTrabajador[]> {
    await comprobarAdministrador(this.pool, actorId);
    const { rows } = await this.pool.query<DocumentoTrabajador>(
      `
      SELECT dv.documento_id::text AS "documentoId",
             dv.trabajador_id::text AS "trabajadorId",
             COALESCE(pt.nombre, 'Trabajador #' || dv.trabajador_id::text) AS "trabajadorNombre",
             dv.tipo,
             dv.referencia_archivo AS "referenciaArchivo",
             dv.presentado_en AS "presentadoEn",
             ultima.resultado,
             ultima.motivo AS "motivoRevision",
             ultima.revisado_en AS "revisadoEn",
             pr.nombre AS "revisorNombre"
      FROM arreglalo.documento_verificacion dv
      JOIN arreglalo.trabajador t ON t.usuario_id = dv.trabajador_id
      LEFT JOIN arreglalo.perfil_usuario pt ON pt.usuario_id = dv.trabajador_id
      LEFT JOIN LATERAL (
        SELECT rd.resultado, rd.motivo, rd.revisado_en, rd.revisor_id
        FROM arreglalo.revision_documento rd
        WHERE rd.documento_id = dv.documento_id
        ORDER BY rd.revisado_en DESC, rd.revision_id DESC
        LIMIT 1
      ) ultima ON true
      LEFT JOIN arreglalo.perfil_usuario pr ON pr.usuario_id = ultima.revisor_id
      WHERE ($1::text = 'todos'
        OR ($1::text = 'pendiente' AND ultima.resultado IS NULL)
        OR ($1::text <> 'todos' AND $1::text <> 'pendiente' AND ultima.resultado = $1::text))
      ORDER BY (ultima.resultado IS NOT NULL), dv.presentado_en ASC, dv.documento_id ASC
      `,
      [estado],
    );
    return rows;
  }

  async revisarDocumento(
    actorId: string,
    documentoId: string,
    resultado: ResultadoDocumento,
    motivo: string,
  ): Promise<RevisionDocumentoRegistrada> {
    const cliente = await this.pool.connect();
    let descartar = false;
    try {
      await cliente.query('BEGIN');
      await comprobarAdministrador(cliente, actorId);
      const { rows: [documento] } = await cliente.query<{ documentoId: string }>(
        `SELECT documento_id::text AS "documentoId"
         FROM arreglalo.documento_verificacion
         WHERE documento_id = $1::bigint
         FOR UPDATE`,
        [documentoId],
      );
      if (!documento) throw new Error('No se encontró el documento del trabajador.');

      const { rows: [fila] } = await cliente.query<RevisionDocumentoRegistrada>(
        `INSERT INTO arreglalo.revision_documento
           (documento_id, revisor_id, resultado, motivo)
         VALUES ($1::bigint, $2::bigint, $3, $4)
         RETURNING revision_id::text AS "revisionId",
                   documento_id::text AS "documentoId",
                   resultado, motivo, revisado_en AS "revisadoEn"`,
        [documentoId, actorId, resultado, motivo],
      );
      if (!fila) throw new Error('PostgreSQL no devolvió la revisión documental.');
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
