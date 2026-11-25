
export interface ServicioSolicitado {
  categoriaId: string;
  categoria: string;
  descripcion: string | null;
}

export interface SolicitudDisponible {
  solicitudId: string;
  creadaEn: string;
  descripcion: string;
  presupuestoAproximado: number | null;
  urgente: boolean;
  zona: string;
  servicios: ServicioSolicitado[];
}

export interface OfertaTrabajador {
  id: string;
  solicitudId: string;
  descripcion: string;
  estado: string;
  visitaId: string | null;
  estadoVisita: string | null;
  visitaProgramada: string | null;
  cotizacionId: string | null;
  reservaId: string | null;
  decision: string | null;
}
