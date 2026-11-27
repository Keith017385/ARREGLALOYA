import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { CatalogoTrabajadoresRepository, TrabajadorCatalogo } from '../CORE/catalogo-trabajadores';
import { DbService } from './db.service';

@Injectable()
export class PostgresCatalogoTrabajadoresRepository extends CatalogoTrabajadoresRepository {
  constructor(private readonly db: DbService) {
    super();
  }

  async listar(categoriaId: string): Promise<TrabajadorCatalogo[]> {
    const sql = [
      "SELECT",
      "  t.usuario_id::text AS id,",
      "  COALESCE(p.nombre, 'Trabajador #' || t.usuario_id) AS nombre,",
      "  t.zona_id::text AS \"zonaId\",",
      "  z.nombre AS zona,",
      "  COALESCE(prom.opiniones, 0)::int AS opiniones,",
      "  prom.puntuacion_promedio::text AS puntuacion",
      "FROM arreglalo.trabajador t",
      "JOIN arreglalo.usuario u ON u.usuario_id = t.usuario_id AND u.estado = 'activo'",
      "JOIN arreglalo.zona z ON z.zona_id = t.zona_id",
      "LEFT JOIN arreglalo.perfil_usuario p ON p.usuario_id = t.usuario_id",
      "LEFT JOIN arreglalo.v_promedio_trabajador prom ON prom.trabajador_id = t.usuario_id",
      "WHERE arreglalo.tiene_rol(t.usuario_id, 'trabajador')",
      "  AND EXISTS (",
      "    SELECT 1 FROM arreglalo.trabajador_categoria tc",
      "    WHERE tc.trabajador_id = t.usuario_id AND tc.categoria_id = $1",
      "  )",
      "  AND 2 = (",
      "    SELECT count(*)",
      "    FROM (",
      "      SELECT DISTINCT ON (tipo) documento_id",
      "      FROM arreglalo.documento_verificacion",
      "      WHERE trabajador_id = t.usuario_id AND tipo IN ('carnet', 'certificado')",
      "      ORDER BY tipo, presentado_en DESC, documento_id DESC",
      "    ) d",
      "    JOIN LATERAL (",
      "      SELECT resultado FROM arreglalo.revision_documento",
      "      WHERE documento_id = d.documento_id",
      "      ORDER BY revisado_en DESC, revision_id DESC LIMIT 1",
      "    ) revision ON true",
      "    WHERE revision.resultado = 'aprobado'",
      "  )",
      "ORDER BY prom.puntuacion_promedio DESC NULLS LAST, p.nombre, t.usuario_id",
      "LIMIT 100",
    ].join('\n');
    try {
      const resultado = await this.db.pool.query<TrabajadorCatalogo>(sql, [categoriaId]);
      return resultado.rows;
    } catch {
      throw new ServiceUnavailableException('No se pudo consultar a los trabajadores disponibles.');
    }
  }
}