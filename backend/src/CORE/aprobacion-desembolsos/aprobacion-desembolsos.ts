export type DecisionDesembolso = 'aprobada' | 'rechazada';

export interface DatosDecisionDesembolso {
  decision: DecisionDesembolso;
  importeAutorizadoCentavos: number | null;
  motivo: string;
}

/** Valida la decisión financiera antes de iniciar la transacción PostgreSQL. */
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
    if (typeof importeAutorizadoCentavos !== 'number'
        || !Number.isSafeInteger(importeAutorizadoCentavos)
        || importeAutorizadoCentavos <= 0) {
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
