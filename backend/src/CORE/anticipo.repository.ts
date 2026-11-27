export interface DatosPagoAnticipo {
  referencia: string;
  fechaTransferencia: Date;
  comprobante?: {
    nombre: string;
    mime: 'application/pdf' | 'image/png' | 'image/jpeg';
    contenido: Buffer;
  };
}

export interface InstruccionesAnticipo {
  configurado: boolean;
  banco: string | null;
  beneficiario: string | null;
  cuenta: string | null;
  qrUrl: string | null;
}

export interface ProcesoAnticipo {
  reservaId: string;
  estadoReserva: string;
  importe: string;
  pagoAcreditado: boolean;
  declaracion: null | {
    id: string;
    estado: 'pendiente' | 'acreditada' | 'rechazada';
    referencia: string;
    fechaTransferencia: Date;
    solicitadaEn: Date;
    motivoRevision: string | null;
  };
}

export interface AnticipoPendiente {
  id: string;
  reservaId: string;
  cliente: string;
  servicio: string;
  importe: string;
  referencia: string;
  fechaTransferencia: Date;
  solicitadaEn: Date;
  comprobanteDisponible: boolean;
}

export interface ComprobanteAnticipo {
  nombre: string;
  mime: string;
  contenido: Buffer;
}

export abstract class AnticipoRepository {
  abstract consultar(reservaId: string, actorId: string): Promise<ProcesoAnticipo | null>;
  abstract listarPropias(actorId: string): Promise<ProcesoAnticipo[]>;
  abstract declarar(reservaId: string, actorId: string, datos: DatosPagoAnticipo): Promise<ProcesoAnticipo>;
  abstract listarPendientes(actorId: string): Promise<AnticipoPendiente[]>;
  abstract obtenerComprobante(actorId: string, declaracionId: string): Promise<ComprobanteAnticipo | null>;
  abstract resolver(
    actorId: string,
    declaracionId: string,
    decision: 'acreditada' | 'rechazada',
    motivo: string,
  ): Promise<{ declaracionId: string; reservaId: string; estado: string }>;
}
