export type CausalCancelacionCliente = 'cliente_anticipada' | 'cliente_tardia';

export interface VistaPreviaCancelacionCliente {
  causal: CausalCancelacionCliente;
  reembolsoCentavos: number;
  compensacionTrabajadorCentavos: number;
  repartoPlataformaCentavos: number;
}

const DOS_HORAS_MS = 2 * 60 * 60 * 1000;

export function calcularVistaPreviaCancelacion(
  inicioProgramado: Date,
  solicitadaEn: Date,
  fondoNoDesembolsadoCentavos: number,
): VistaPreviaCancelacionCliente {
  const inicio = inicioProgramado.getTime();
  const solicitud = solicitadaEn.getTime();

  if (!Number.isFinite(inicio) || !Number.isFinite(solicitud)) {
    throw new Error('Las fechas de la cancelacion no son validas.');
  }

  if (solicitud >= inicio) {
    throw new Error('La cancelacion debe solicitarse antes del inicio programado.');
  }

  if (!Number.isSafeInteger(fondoNoDesembolsadoCentavos)
      || fondoNoDesembolsadoCentavos < 0) {
    throw new Error('El fondo debe expresarse en centavos enteros no negativos.');
  }

  if (inicio - solicitud >= DOS_HORAS_MS) {
    return {
      causal: 'cliente_anticipada',
      reembolsoCentavos: fondoNoDesembolsadoCentavos,
      compensacionTrabajadorCentavos: 0,
      repartoPlataformaCentavos: 0,
    };
  }

  // Replica el redondeo de PostgreSQL para la mitad del trabajador.
  const compensacionTrabajadorCentavos = Math.ceil(fondoNoDesembolsadoCentavos / 2);

  return {
    causal: 'cliente_tardia',
    reembolsoCentavos: 0,
    compensacionTrabajadorCentavos,
    repartoPlataformaCentavos: fondoNoDesembolsadoCentavos - compensacionTrabajadorCentavos,
  };
}
