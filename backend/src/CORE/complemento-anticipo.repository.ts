/**
 * Contratos que el SERVICE necesita, sin importar si los datos vienen
 * de PostgreSQL, de una API externa o de un repositorio simulado.
 */
export interface ComplementoAnticipoPendiente {
  reservaId: string;
  precioFinal: string;
  anticipoObjetivo: string;
  anticipoRecibido: string;
  complementoPendiente: string;
}

export interface SolicitudComplementoAnticipo {
  solicitudId: string;
  importeSolicitado: string;
  reutilizada: boolean;
}

export interface ConsultaComplementoAnticipoRepository {
  consultar(reservaId: string, clienteId: string): Promise<ComplementoAnticipoPendiente | null>;
}

export interface InicioComplementoAnticipoRepository {
  iniciar(reservaId: string, clienteId: string): Promise<SolicitudComplementoAnticipo>;
}
