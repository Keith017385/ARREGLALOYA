export type ResultadoResolucionPago = 'pago_acreditado' | 'pago_no_acreditado';

export interface DatosResolucionPago {
  resultado: ResultadoResolucionPago;
  motivo: string;
}

export function prepararResolucionPago(
  resultado: unknown,
  motivo: unknown,
): DatosResolucionPago {
  if (resultado !== 'pago_acreditado' && resultado !== 'pago_no_acreditado') {
    throw new Error('Selecciona un resultado valido para la resolucion del pago.');
  }

  if (typeof motivo !== 'string') {
    throw new Error('El motivo debe tener entre 1 y 2000 caracteres.');
  }

  const texto = motivo.trim();
  if (!texto || [...texto].length > 2000 || texto.includes('\0')) {
    throw new Error('El motivo debe tener entre 1 y 2000 caracteres y ser un texto valido.');
  }

  return { resultado, motivo: texto };
}
