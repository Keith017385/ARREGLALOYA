export interface Categoria {
  id: string;
  codigo: string;
  nombre: string;
}
// Contrato que permite probar el caso de uso sin conectarse a PostgreSQL.
export abstract class CategoriasRepository {
  abstract listar(busqueda: string): Promise<Categoria[]>;
}
