export interface DesembolsoConfirmado {
  movimientoId: string;
  importeCentavos: number;
}

export interface LiquidacionCancelacionTrabajador {
  reembolsoCentavos: number;
  deudaCentavos: number;
  desembolsos: DesembolsoConfirmado[];
}

export function calcularLiquidacionCancelacionTrabajador(
  anticipoRecibidoCentavos: number,
  desembolsos: DesembolsoConfirmado[],
): LiquidacionCancelacionTrabajador {

  if (
    !Number.isSafeInteger(anticipoRecibidoCentavos) ||
    anticipoRecibidoCentavos < 0
  ) {
    throw new Error('El anticipo recibido no es valido.');
  }

  const ids = new Set<string>();
  let deudaCentavos = 0;

  for (const desembolso of desembolsos) {
    if (
      !/^[1-9][0-9]{0,18}$/.test(desembolso.movimientoId) ||
      !Number.isSafeInteger(desembolso.importeCentavos) ||
      desembolso.importeCentavos <= 0
    ) {
      throw new Error('Existe un desembolso invalido.');
    }

    if (ids.has(desembolso.movimientoId)) {
      throw new Error('Existe un desembolso duplicado.');
    }

    ids.add(desembolso.movimientoId);
    deudaCentavos += desembolso.importeCentavos;
  }

  if (!Number.isSafeInteger(deudaCentavos)) {
    throw new Error('El importe de la deuda excede el limite permitido.');
  }

  return {
    // Se devuelve el anticipo completo, incluida la comisión.
    reembolsoCentavos: anticipoRecibidoCentavos,

    // Los desembolsos se registran como deuda independiente.
    deudaCentavos,

    desembolsos,
  };
}