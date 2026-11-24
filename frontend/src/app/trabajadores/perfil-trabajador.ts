export interface PerfilTrabajador {
  usuarioId: string; nombre: string | null; telefono: string | null;
  correoContacto: string | null; direccion: string | null; zonaId: string;
}
export interface DatosPerfil {
  nombre: string; telefono: string | null; correoContacto: string | null; direccion: string | null;
}
export interface ServicioTrabajador { id: string; codigo: string; nombre: string; }