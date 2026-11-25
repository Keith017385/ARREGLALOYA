import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import {
  DatosDocumento,
  DocumentoVerificacion,
  DocumentoVerificacionRepository,
} from '../CORE/documento-verificacion';
import { DbService } from './db.service';

// Un documento está pendiente hasta que alguien lo revisa; después muestra el resultado de la última revisión.
const SELECT_DOCUMENTOS = `SELECT d.documento_id::text AS id, d.tipo,
    d.referencia_archivo AS "referenciaArchivo", d.presentado_en AS "presentadoEn",
    COALESCE(r.resultado, 'pendiente') AS estado, r.motivo, r.revisado_en AS "revisadoEn"
  FROM arreglalo.documento_verificacion d
  LEFT JOIN LATERAL (
    SELECT resultado, motivo, revisado_en
    FROM arreglalo.revision_documento
    WHERE documento_id = d.documento_id
    ORDER BY revisado_en DESC, revision_id DESC
    LIMIT 1
  ) r ON true`;

@Injectable()
export class PostgresDocumentoVerificacionRepository extends DocumentoVerificacionRepository {
  constructor(private readonly db: DbService) { super(); }

  async listar(trabajadorId: string): Promise<DocumentoVerificacion[]> {
    const sql = `${SELECT_DOCUMENTOS}
      WHERE d.trabajador_id = $1::bigint
      ORDER BY d.presentado_en DESC, d.documento_id DESC`;
    try {
      const r = await this.db.pool.query<DocumentoVerificacion>(sql, [trabajadorId]);
      return r.rows;
    } catch {
      throw new ServiceUnavailableException('No se pudieron consultar los documentos.');
    }
  }

  async crear(trabajadorId: string, datos: DatosDocumento): Promise<DocumentoVerificacion | null> {
    const sql = `INSERT INTO arreglalo.documento_verificacion (trabajador_id, tipo, referencia_archivo)
      SELECT $1::bigint, $2::text, $3::text
      WHERE EXISTS (SELECT 1 FROM arreglalo.trabajador WHERE usuario_id = $1::bigint)
      RETURNING documento_id::text AS id`;
    let id = '';
    try {
      const r = await this.db.pool.query<{ id: string }>(sql, [
        trabajadorId, datos.tipo, datos.referenciaArchivo,
      ]);
      if (r.rowCount === 0) return null;
      id = r.rows[0].id;
    } catch {
      throw new ServiceUnavailableException('No se pudo guardar el documento.');
    }
    try {
      const r = await this.db.pool.query<DocumentoVerificacion>(
        `${SELECT_DOCUMENTOS} WHERE d.documento_id = $1::bigint`,
        [id],
      );
      return r.rows[0] ?? null;
    } catch {
      throw new ServiceUnavailableException('No se pudo consultar el documento guardado.');
    }
  }
}