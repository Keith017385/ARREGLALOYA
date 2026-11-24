export interface ReservaParaFinalizacion {
  id: string;
  clienteId: string;
  estado: string;
}

export interface CodigoParaFinalizacion {
  reservaId: string;
  consumidoEn: Date | null;
}

export function validarConfirmacionFinalizacion(
  reserva: ReservaParaFinalizacion,
  clienteId: string,
  codigo: CodigoParaFinalizacion | null,
): void {
  if (clienteId !== reserva.clienteId) {
    throw new Error('Solo el cliente de la reserva puede confirmar la finalizacion.');
  }

  if (!codigo || codigo.reservaId !== reserva.id) {
    throw new Error('El codigo no es valido para esta reserva.');
  }

  if (codigo.consumidoEn !== null) {
    throw new Error('El codigo ya fue utilizado.');
  }

  if (reserva.estado !== 'en_ejecucion') {
    throw new Error('La reserva debe estar en ejecucion para finalizar.');
  }
}