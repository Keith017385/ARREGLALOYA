export interface PerfilTrabajador {
  usuarioId: string;
  nombre: string;
  telefono: string | null;
  correoContacto: string | null;
  direccion: string | null;
  zonaId: string;
}

export interface DatosPerfil {
  nombre: string;
  telefono: string | null;
  correoContacto: string | null;
  direccion: string | null;
}

export interface CategoriaTrabajador {
  id: string;
  codigo: string;
  nombre: string;
}

// Contrato que permite probar el caso de uso sin conectarse a PostgreSQL.
export abstract class PerfilTrabajadorRepository {
  abstract obtener(usuarioId: string): Promise<PerfilTrabajador | null>;
  abstract actualizar(usuarioId: string, datos: DatosPerfil): Promise<PerfilTrabajador | null>;
  abstract listarCategorias(usuarioId: string): Promise<CategoriaTrabajador[]>;
  abstract agregarCategoria(usuarioId: string, categoriaId: string): Promise<void>;
  abstract quitarCategoria(usuarioId: string, categoriaId: string): Promise<void>;
}