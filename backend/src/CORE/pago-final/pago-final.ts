export interface ReservaParaPagoFinal {
  clienteId: string;
  estado: string;
  precioFinal: number;
  anticipoRecibido: number;
  pagosDirectosConfirmados: number;
  tieneModificacionPendiente: boolean;
  tienePagoPendiente: boolean;
}

export function calcularSaldoDirecto(
  precioFinal: number,
  anticipoRecibido: number,
  pagosDirectosConfirmados: number,
): number {
  const importes = [precioFinal, anticipoRecibido, pagosDirectosConfirmados];

  if (
    importes.some((importe) => !Number.isSafeInteger(importe) || importe < 0)
  ) {
    throw new RangeError('Los importes deben ser enteros no negativos en centavos.');
  }

  const totalRecibido = anticipoRecibido + pagosDirectosConfirmados;
  if (!Number.isSafeInteger(totalRecibido)) {
    throw new RangeError('El total recibido supera el rango admitido.');
  }

  // Un saldo negativo indica un exceso que debe revisarse.
  return precioFinal - totalRecibido;
}

export function validarDeclaracionPagoFinal(
  reserva: ReservaParaPagoFinal,
  actorId: string,
  importeDeclarado: number,
): void {
  if (actorId !== reserva.clienteId) {
    throw new Error('Solo el cliente de la reserva puede declarar el pago.');
  }

  if (reserva.estado !== 'finalizada') {
    throw new Error('La reserva debe estar finalizada para declarar el pago.');
  }

  if (reserva.tieneModificacionPendiente) {
    throw new Error('Hay una modificacion de precio pendiente de decision.');
  }

  if (reserva.tienePagoPendiente) {
    throw new Error('Ya hay un pago declarado pendiente de confirmacion.');
  }

  const saldo = calcularSaldoDirecto(
    reserva.precioFinal,
    reserva.anticipoRecibido,
    reserva.pagosDirectosConfirmados,
  );

  if (saldo < 0) {
    throw new Error('El saldo requiere revision por exceso de pago.');
  }

  if (saldo === 0) {
    throw new Error('La reserva no tiene saldo pendiente.');
  }

  if (importeDeclarado !== saldo) {
    throw new Error('El pago final debe coincidir con el saldo pendiente.');
  }
}