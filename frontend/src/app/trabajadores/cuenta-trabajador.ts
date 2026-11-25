export type EstadoCuenta = 'activo' | 'suspendido_voluntario' | 'suspendido_sancion' | 'eliminado';

export interface CuentaTrabajador {
  usuarioId: string;
  estado: EstadoCuenta;
  suspendidaDesde: string | null;
}