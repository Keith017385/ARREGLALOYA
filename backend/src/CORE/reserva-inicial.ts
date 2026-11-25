export interface ResumenReservaInicial {
  precio: string;
  anticipo: string;
  comision: string;
  reservaId: string | null;
  estado: string | null;
}

export abstract class ReservaInicialRepository {
  abstract consultar(clienteId: string, cotizacionId: string): Promise<ResumenReservaInicial | null>;
  abstract crear(clienteId: string, cotizacionId: string, inicio: Date): Promise<ResumenReservaInicial | null>;
}
