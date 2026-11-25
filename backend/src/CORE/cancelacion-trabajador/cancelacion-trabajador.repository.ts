export interface ContextoCancelacionTrabajador {
  estado: string;
  inicioProgramado: Date;
  clienteId: string;
  trabajadorId: string;
  rolTrabajadorActivo: boolean;
  requiereConciliacion: boolean;
  reembolsoCentavos: number;
  desembolsosPreviosCentavos: number;
}

/** Datos que la interfaz muestra y que se vuelven a contrastar dentro de la transacción. */
export interface VistaPreviaCancelacionTrabajador {
  reservaId: string;
  estado: string;
  inicioProgramado: string;
  reembolsoCentavos: number;
  desembolsosPreviosCentavos: number;
}

export interface CancelacionTrabajadorConfirmada {
  reservaId: string;
  cancelacionId: string;
  incidenteId: string;
  solicitudFinancieraId: string | null;
  estadoAnterior: string;
  estadoNuevo: 'cancelada';
  reembolsoCentavos: number;
  desembolsosPreviosCentavos: number;
}

export interface CancelacionTrabajadorRepository {
  consultarContexto(
    reservaId: string,
    trabajadorId: string,
  ): Promise<ContextoCancelacionTrabajador | null>;

  confirmar(
    reservaId: string,
    trabajadorId: string,
    motivo: string,
    vistaPrevia: VistaPreviaCancelacionTrabajador,
  ): Promise<CancelacionTrabajadorConfirmada>;
}
