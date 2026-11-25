import {
    Usuario, 
    PerfilUsuario,
    CuentaAcceso,
    RolUsuario,
    NuevaCuenta
}from './usuario'

export abstract class UsuariosRepository
{

    abstract buscarCuenta(
        identificador: string
    ): Promise<CuentaAcceso | null>

    abstract roles(usuarioId: string): Promise<RolUsuario[]>;
    abstract editarPerfil(usuarioId: string, cambios: Omit<PerfilUsuario, 'usuarioId'>): Promise<boolean>;

    abstract buscarUsuario(usuarioId: string): Promise<Usuario | null>;

    abstract buscarPerfil(
        usuarioId: string
    ): Promise<PerfilUsuario | null>

    
    abstract registrarCuenta(
    datos: NuevaCuenta
    ): Promise<Usuario>;
}
