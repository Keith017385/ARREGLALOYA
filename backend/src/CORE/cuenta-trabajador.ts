export type EstadoCuenta = 'activo' | 'suspendido_voluntario' | 'suspendido_sancion' | 'eliminado';

export interface CuentaTrabajador {
  usuarioId: string;
  estado: EstadoCuenta;
  suspendidaDesde: Date | null;
}

export type ResultadoCambioCuenta = 'ok' | 'no_encontrado' | 'estado_no_permitido';

// Contrato que permite probar el caso de uso sin conectarse a PostgreSQL.
export abstract class CuentaTrabajadorRepository {
  abstract obtener(usuarioId: string): Promise<CuentaTrabajador | null>;
  abstract suspender(usuarioId: string): Promise<ResultadoCambioCuenta>;
  abstract reactivar(usuarioId: string): Promise<ResultadoCambioCuenta>;
}