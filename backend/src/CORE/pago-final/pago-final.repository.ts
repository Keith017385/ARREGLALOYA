import type { ReservaParaPagoFinal } from './pago-final';

export interface ContratacionParaPagoFinal extends ReservaParaPagoFinal {
  id: string;
  trabajadorId: string;
}

export interface PagoDirectoRegistrado {
  id: string;
  reservaId: string;
  importeCentavos: number;
  declaradoEn: Date;
  confirmadoEn: Date | null;
}

export interface DiscrepanciaPagoRegistrada {
  id: string;
  pagoId: string;
  solicitadaEn: Date;
}

export interface OperacionesPagoFinal {
  consultarUltimoPago(actorId: string): Promise<{
    pagoRegistrado: PagoDirectoRegistrado | null;
    enRevision: boolean;
    yaSolicitoRevision: boolean;
  }>;
  consultarPlazo(): Promise<{ finalizadaEn: Date | null; ahora: Date }>;
  registrarDiscrepancia(datos: {
    pagoId: string;
    solicitanteId: string;
    declaracion: string;
    importeCentavos: number | null;
    solicitadaEn: Date;
  }): Promise<DiscrepanciaPagoRegistrada>;
  obtenerReserva(): Promise<ContratacionParaPagoFinal | null>;
  buscarPago(pagoId: string): Promise<PagoDirectoRegistrado | null>;
  registrarDeclaracion(importeCentavos: number): Promise<PagoDirectoRegistrado>;
  confirmarPago(pagoId: string): Promise<PagoDirectoRegistrado>;
}

export interface PagoFinalRepository {
  // El adaptador bloquearÃ¡ la reserva antes de leer el saldo o el pago.
  // La comprobaciÃ³n y la escritura se ejecutarÃ¡n en la misma transacciÃ³n.
  enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesPagoFinal) => Promise<T>,
  ): Promise<T>;
}