import type { DatosSancion } from './incidentes-sanciones';

export interface IncidenteRegistrado {
  id: string;
  reservaId: string;
  descripcion: string;
  registradoEn: Date;
  confirmadoEn: Date | null;
  registradoPorId: string | null;
  confirmadoPorId: string | null;
}

export type RegistroIncidente =
  | { estado: 'sin_permiso' }
  | { estado: 'reserva_inexistente' }
  | { estado: 'registrado'; incidente: IncidenteRegistrado };

export interface DetalleIncidente extends Omit<IncidenteRegistrado, 'reservaId'> {
  reservaId: string | null;
  participantes: { usuarioId: string; participacion: string }[];
}

export type ConsultaIncidente =
  | { estado: 'sin_permiso' }
  | { estado: 'incidente_inexistente' }
  | { estado: 'encontrado'; incidente: DetalleIncidente };

export type ConfirmacionIncidente =
  | { estado: 'sin_permiso' }
  | { estado: 'incidente_inexistente' }
  | { estado: 'ya_confirmado' }
  | { estado: 'confirmado'; incidenteId: string; confirmadoEn: Date; confirmadoPorId: string };

export interface SancionRegistrada extends DatosSancion {
  id: string;
  incidenteId: string;
  usuarioId: string;
  aplicadaPorId: string;
}

export type RegistroSancion =
  | { estado: 'sin_permiso' }
  | { estado: 'incidente_inexistente' }
  | { estado: 'incidente_no_confirmado' }
  | { estado: 'usuario_no_vinculado' }
  | { estado: 'registrada'; sancion: SancionRegistrada };

export interface IncidentesSancionesRepository {
  registrarSancion(
    incidenteId: string,
    usuarioId: string,
    actorId: string,
    datos: DatosSancion,
  ): Promise<RegistroSancion>;
  confirmarIncidente(incidenteId: string, actorId: string): Promise<ConfirmacionIncidente>;
  consultarIncidente(incidenteId: string, actorId: string): Promise<ConsultaIncidente>;
  registrarIncidente(
    reservaId: string,
    actorId: string,
    descripcion: string,
  ): Promise<RegistroIncidente>;
}
