export type DecisionDesembolso = 'aprobada' | 'rechazada';

export interface DatosDecisionDesembolso {
  decision: DecisionDesembolso;
  importeAutorizadoCentavos: number | null;
  motivo: string;
}

export interface CondicionesTransferencia {
  tipoSolicitud: string;
  estadoReserva: string;
  importeSolicitadoCentavos: number;
  disponibleCentavos: number;
  documentoDisponible: boolean;
  reclamoEnRevision: boolean;
  movimientoExistente: boolean;
}

const ESTADOS_RESERVA_TRANSFERIBLES = new Set([
  'reservada',
  'en_ejecucion',
  'finalizada',
]);

/** Valida los datos que llegan desde el administrador antes de tocar PostgreSQL. */
export function prepararDecisionDesembolso(
  decision: unknown,
  importeAutorizadoCentavos: unknown,
  motivo: unknown,
): DatosDecisionDesembolso {
  if (decision !== 'aprobada' && decision !== 'rechazada') {
    throw new Error('La decisión del desembolso debe ser aprobada o rechazada.');
  }

  if (typeof motivo !== 'string') {
    throw new Error('El motivo de la decisión es obligatorio.');
  }

  const justificacion = motivo.trim();
  if (!justificacion || justificacion.length > 2000 || justificacion.includes('\0')) {
    throw new Error('El motivo de la decisión debe tener entre 1 y 2000 caracteres.');
  }

  if (decision === 'aprobada') {
    if (
      typeof importeAutorizadoCentavos !== 'number'
      || !Number.isSafeInteger(importeAutorizadoCentavos)
      || importeAutorizadoCentavos <= 0
    ) {
      throw new Error('El importe autorizado debe ser un entero positivo en centavos.');
    }

    return {
      decision,
      importeAutorizadoCentavos,
      motivo: justificacion,
    };
  }

  if (importeAutorizadoCentavos != null) {
    throw new Error('Una solicitud rechazada no debe tener un importe autorizado.');
  }

  return { decision, importeAutorizadoCentavos: null, motivo: justificacion };
}

/** Devuelve las condiciones que impiden autorizar una transferencia. */
export function obtenerMotivosBloqueoTransferencia(
  condiciones: CondicionesTransferencia,
): string[] {
  const motivos: string[] = [];

  if (condiciones.tipoSolicitud !== 'desembolso') {
    motivos.push('La solicitud financiera no corresponde a un desembolso.');
  }

  if (!ESTADOS_RESERVA_TRANSFERIBLES.has(condiciones.estadoReserva)) {
    motivos.push('La reserva no admite desembolsos en su estado actual.');
  }

  if (!condiciones.documentoDisponible) {
    motivos.push('La solicitud no tiene un documento PDF de respaldo.');
  }

  if (condiciones.reclamoEnRevision) {
    motivos.push('No se puede autorizar mientras exista un reclamo vinculado en revisión.');
  }

  if (condiciones.movimientoExistente) {
    motivos.push('La solicitud ya tiene un movimiento financiero asociado; requiere conciliación.');
  }

  if (
    !Number.isSafeInteger(condiciones.importeSolicitadoCentavos)
    || condiciones.importeSolicitadoCentavos <= 0
  ) {
    motivos.push('El importe solicitado no es válido.');
  }

  if (
    !Number.isSafeInteger(condiciones.disponibleCentavos)
    || condiciones.disponibleCentavos < 0
  ) {
    motivos.push('El fondo disponible no es válido.');
  } else if (condiciones.disponibleCentavos <= 0) {
    motivos.push('No existe fondo disponible para esta solicitud.');
  }

  return motivos;
}

/** Validación de negocio repetida dentro de la transacción, con importes recién leídos. */
export function validarCondicionesTransferencia(
  condiciones: CondicionesTransferencia,
  importeAutorizadoCentavos: number,
): void {
  const bloqueos = obtenerMotivosBloqueoTransferencia(condiciones);
  if (bloqueos.length > 0) {
    throw new Error(bloqueos[0]);
  }

  if (!Number.isSafeInteger(importeAutorizadoCentavos) || importeAutorizadoCentavos <= 0) {
    throw new Error('El importe autorizado debe ser un entero positivo en centavos.');
  }

  if (importeAutorizadoCentavos > condiciones.importeSolicitadoCentavos) {
    throw new Error('El importe autorizado supera el importe solicitado.');
  }

  if (importeAutorizadoCentavos > condiciones.disponibleCentavos) {
    throw new Error('El importe autorizado supera el fondo disponible para esta reserva.');
  }
}

export function calcularMaximoAutorizableCentavos(
  condiciones: CondicionesTransferencia,
): number {
  if (obtenerMotivosBloqueoTransferencia(condiciones).length > 0) {
    return 0;
  }
  return Math.min(
    condiciones.importeSolicitadoCentavos,
    condiciones.disponibleCentavos,
  );
}
