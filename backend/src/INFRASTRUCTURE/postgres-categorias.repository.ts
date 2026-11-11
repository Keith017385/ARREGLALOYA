import { Injectable, ServiceUnavailableException } from '@nestjs/common';
import { Categoria, CategoriasRepository } from '../CORE/categoria';
import { DbService } from './db.service';
@Injectable()
export class PostgresCategoriasRepository extends CategoriasRepository {
  constructor(private readonly db: DbService) { super(); }
  async listar(busqueda: string): Promise<Categoria[]> {
    const sql = `SELECT categoria_id::text AS id, codigo, nombre
      FROM arreglalo.categoria
      WHERE $1 = '' OR strpos(lower(nombre), lower($1)) > 0
      ORDER BY nombre, categoria_id LIMIT 100`;
    try {
      const resultado = await this.db.pool.query<Categoria>(sql, [busqueda]);
      return resultado.rows;
    } catch {
      throw new ServiceUnavailableException('No se pudo consultar el catálogo.');
    }
  }
}
