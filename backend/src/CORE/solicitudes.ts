export interface ServicioSolicitado {
  categoriaId: string;
  descripcion: string;
}

export interface NuevaSolicitud {
  descripcion: string;
  ubicacion: string;
  zonaId: string;
  urgente: boolean;
  servicios: ServicioSolicitado[];
}

export interface SolicitudPublicada extends NuevaSolicitud {
  id: string;
  creadaEn: Date;
  estado: string;
}

export type CambiosSolicitud = Pick<NuevaSolicitud, 'descripcion' | 'ubicacion'>;

export interface EventoSolicitud {
  registradaEn: Date;
  estado: string;
  campos: string[];
}

export abstract class SolicitudesRepository {
  abstract esCliente(usuarioId: string): Promise<boolean>;
  abstract zonas(): Promise<Array<{ id: string; nombre: string }>>;
  abstract listar(usuarioId: string): Promise<SolicitudPublicada[]>;
  abstract modificar(usuarioId: string, solicitudId: string, cambios: CambiosSolicitud): Promise<boolean>;
  abstract historial(usuarioId: string, solicitudId: string): Promise<EventoSolicitud[] | null>;
  abstract publicar(usuarioId: string, datos: NuevaSolicitud): Promise<string>;
}
