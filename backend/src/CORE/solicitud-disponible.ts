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