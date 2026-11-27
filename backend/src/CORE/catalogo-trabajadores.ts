export interface TrabajadorCatalogo {
  id: string;
  nombre: string;
  zonaId: string;
  zona: string;
  opiniones: number;
  puntuacion: string | null;
}

export abstract class CatalogoTrabajadoresRepository {
  abstract listar(categoriaId: string): Promise<TrabajadorCatalogo[]>;
}