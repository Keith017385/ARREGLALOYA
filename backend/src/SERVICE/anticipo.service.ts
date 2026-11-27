import { BadRequestException, Injectable } from '@nestjs/common';
import type {
  AnticipoPendiente,
  AnticipoRepository,
  DatosPagoAnticipo,
  InstruccionesAnticipo,
} from '../CORE/anticipo.repository';

@Injectable()
export class AnticipoService {
  constructor(private readonly repo: AnticipoRepository) {}

  async consultar(reservaId: string, actorId: string) {
    const proceso = await this.repo.consultar(reservaId, actorId);
    if (!proceso) throw new Error('No se encontró el anticipo de esta reserva.');
    return { ...proceso, instrucciones: this.leerInstrucciones() };
  }

  async listarPropias(actorId: string) {
    const procesos = await this.repo.listarPropias(actorId);
    const instrucciones = this.leerInstrucciones();
    return procesos.map((proceso) => ({ ...proceso, instrucciones }));
  }

  async declarar(reservaId: string, actorId: string, entrada: {
    referencia: unknown;
    fechaTransferencia: unknown;
    comprobante?: DatosPagoAnticipo['comprobante'];
  }) {
    const referencia = typeof entrada.referencia === 'string' ? entrada.referencia.trim() : '';
    if (!referencia || Array.from(referencia).length > 160 || referencia.includes('\0')) {
      throw new BadRequestException('La referencia de transferencia debe tener entre 1 y 160 caracteres.');
    }

    if (typeof entrada.fechaTransferencia !== 'string'
        || !/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}(?:\.\d{1,3})?Z$/.test(entrada.fechaTransferencia)) {
      throw new BadRequestException('La fecha de transferencia no es válida.');
    }
    const fechaTransferencia = new Date(entrada.fechaTransferencia);
    if (!Number.isFinite(fechaTransferencia.getTime()) || fechaTransferencia.getTime() > Date.now() + 5 * 60_000) {
      throw new BadRequestException('La fecha de transferencia no puede estar en el futuro.');
    }

    if (!this.leerInstrucciones().configurado) {
      throw new Error('El administrador todavía no configuró los datos para recibir anticipos.');
    }

    return this.repo.declarar(reservaId, actorId, {
      referencia,
      fechaTransferencia,
      comprobante: entrada.comprobante,
    });
  }

  listarPendientes(actorId: string): Promise<AnticipoPendiente[]> {
    return this.repo.listarPendientes(actorId);
  }

  obtenerComprobante(actorId: string, declaracionId: string) {
    return this.repo.obtenerComprobante(actorId, declaracionId);
  }

  resolver(actorId: string, declaracionId: string, decision: unknown, motivo: unknown) {
    if (decision !== 'acreditada' && decision !== 'rechazada') {
      throw new BadRequestException('Selecciona si el pago está acreditado o debe rechazarse.');
    }
    if (typeof motivo !== 'string' || Array.from(motivo.trim()).length > 1000 || motivo.includes('\0')) {
      throw new BadRequestException('El motivo no puede superar los 1000 caracteres.');
    }
    const texto = motivo.trim();
    if (decision === 'rechazada' && Array.from(texto).length < 10) {
      throw new BadRequestException('Escribe un motivo de al menos 10 caracteres para que el cliente pueda corregir su declaración.');
    }
    return this.repo.resolver(actorId, declaracionId, decision, texto);
  }

  private leerInstrucciones(): InstruccionesAnticipo {
    const banco = process.env.ANTICIPO_BANCO?.trim() || null;
    const beneficiario = process.env.ANTICIPO_TITULAR?.trim() || null;
    const cuenta = process.env.ANTICIPO_CUENTA?.trim() || null;
    const qr = process.env.ANTICIPO_QR_URL?.trim() || '';
    const qrUrl = /^https:\/\//i.test(qr) ? qr : null;
    return {
      configurado: Boolean(banco && beneficiario && cuenta),
      banco,
      beneficiario,
      cuenta,
      qrUrl,
    };
  }
}
