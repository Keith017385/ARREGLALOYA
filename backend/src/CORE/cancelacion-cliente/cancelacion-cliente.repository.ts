import type { VistaPreviaCancelacionCliente } from './cancelacion-cliente';

export interface ContextoCancelacionCliente {
  estado: string;
  inicioProgramado: Date;
  consultadaEn: Date;
  fondoCentavos: number;
  comisionCentavos: number;
  requiereConciliacion: boolean;
}

export interface LiquidacionCancelacionCliente extends VistaPreviaCancelacionCliente {
  fondoCentavos: number;
  comisionCentavos: number;
}

export interface CancelacionClienteConfirmada extends LiquidacionCancelacionCliente {
  cancelacionId: string;
  reservaId: string;
  solicitudFinancieraId: string | null;
}

export interface AvisoCancelacionTrabajador {
  cancelacionId: string;
  reservaId: string;
  canceladaEn: Date;
  inicioProgramado: Date;
}

export interface CancelacionClienteRepository {
  consultarAvisosDelTrabajador(trabajadorId: string): Promise<AvisoCancelacionTrabajador[]>;
  confirmar(
    reservaId: string,
    clienteId: string,
    motivo: string,
    esperada: LiquidacionCancelacionCliente,
  ): Promise<CancelacionClienteConfirmada>;
  consultarContexto(
    reservaId: string,
    clienteId: string,
  ): Promise<ContextoCancelacionCliente | null>;
}
