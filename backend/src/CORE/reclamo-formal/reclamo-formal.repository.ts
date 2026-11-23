import type { ReservaParaReclamo } from './reclamo-formal';

export interface ReclamoRegistrado {
  id: string;
  reservaId: string;
  descripcion: string;
  estado: 'abierto' | 'en_revision' | 'resuelto';
  presentadoEn: Date;
}

export interface OperacionesReclamo {
  obtenerContexto(): Promise<{
    reserva: ReservaParaReclamo;
    ahora: Date;
  } | null>;
  registrar(
    reportanteId: string,
    descripcion: string,
    presentadoEn: Date,
  ): Promise<ReclamoRegistrado>;
}

export interface ReclamoFormalRepository {
  enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesReclamo) => Promise<T>,
  ): Promise<T>;

  // null indica una reserva inexistente o ajena al cliente.
  consultarDelCliente(
    reservaId: string,
    clienteId: string,
  ): Promise<ReclamoRegistrado[] | null>;
}
