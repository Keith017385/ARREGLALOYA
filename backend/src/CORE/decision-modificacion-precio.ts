import { calcularAjustePrecio } from './calculo-modificacion-precio';

export type DecisionPrecio = 'ACEPTADA' | 'RECHAZADA';

export interface ReservaParaModificarPrecio {
  id: string;
  clienteId: string;
  precioVigente: number;
  anticipoRecibido: number;
  pagosDirectosConfirmados: number;
}

export interface PropuestaPrecio {
  id: string;
  reservaId: string;
  // Importe con signo en centavos. +10000 significa subir Bs 100.
  variacion: number;
  decisionRegistrada: DecisionPrecio | null;
}

export function decidirModificacionPrecio(
  reserva: ReservaParaModificarPrecio,
  propuesta: PropuestaPrecio,
  actorId: string,
  decision: DecisionPrecio,
) {
  if (propuesta.reservaId !== reserva.id) {
    throw new Error('La propuesta no pertenece a esta reserva.');
  }

  if (actorId !== reserva.clienteId) {
    throw new Error('Solo el cliente de la reserva puede decidir.');
  }

  if (propuesta.decisionRegistrada !== null) {
    throw new Error('La propuesta ya tiene una decisión registrada.');
  }

  if (decision === 'RECHAZADA') {
    return {
      propuestaId: propuesta.id,
      decision,
      precioVigente: reserva.precioVigente,
      ajuste: null,
    };
  }

  const nuevoPrecio = reserva.precioVigente + propuesta.variacion;

  return {
    propuestaId: propuesta.id,
    decision,
    precioVigente: nuevoPrecio,
    ajuste: calcularAjustePrecio(
      nuevoPrecio,
      reserva.anticipoRecibido,
      reserva.pagosDirectosConfirmados,
    ),
  };
}