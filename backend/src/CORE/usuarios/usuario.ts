export type RolUsuario =
'cliente'
'trabajador'
'administrador'
'superadministrador'

export interface Usuario{
    usuarioId : string;
    creadoEn: Date;
    estado: string;
}

export interface PerfilUsuario{
    usuarioId: string;
    nombre: string;
    telefono: string | null;
    correoContacto: string | null;
    direccion : string| null;
}

export interface CuentaAcceso{
    usuarioId: string ;
    identificadorAcceso: string ;
    hashCredencial: string ;
}

// Datos que escribe una persona al registrarse.
export type RolAutoregistro = 'cliente' | 'trabajador';
export interface ZonaRegistro { id: string; nombre: string; }
export interface DatosRegistro {
  nombre: string;
  identificadorAcceso: string;
  contrasena: string;
  rol?: RolAutoregistro;
  zonaId?: string;
}

// Datos preparados para guardar en PostgreSQL.
export interface NuevaCuenta {
  nombre: string;
  identificadorAcceso: string;
  hashCredencial: string;
  rol: RolAutoregistro;
  zonaId?: string;
}
