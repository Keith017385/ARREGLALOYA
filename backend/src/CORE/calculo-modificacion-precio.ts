export function calcularAjustePrecio(
  precioAceptado: number,
  anticipoRecibido: number,
  pagosDirectosConfirmados = 0,
) {
  const importes = [
    precioAceptado,
    anticipoRecibido,
    pagosDirectosConfirmados,
  ];

  if (importes.some((importe) => !Number.isSafeInteger(importe) || importe < 0)) {
    throw new RangeError('Los importes deben ser enteros no negativos en centavos.');
  }

  const totalPagado = anticipoRecibido + pagosDirectosConfirmados;
  if (!Number.isSafeInteger(totalPagado)) {
    throw new RangeError('El total pagado supera el rango admitido.');
  }

  // Las divisiones enteras redondean al centavo más cercano.
  const anticipoObjetivo = Number((BigInt(precioAceptado) + 2n) / 4n);
  const comisionObjetivo = Number((BigInt(anticipoObjetivo) + 10n) / 20n);
  const saldoCalculado = precioAceptado - totalPagado;

  return {
    anticipoObjetivo,
    comisionObjetivo,
    complementoAnticipo: Math.max(0, anticipoObjetivo - anticipoRecibido),
    saldoPendiente: Math.max(0, saldoCalculado),
    excesoPagado: Math.max(0, -saldoCalculado),
  };
}