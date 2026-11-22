import type {
  PropuestaPrecio,
  ReservaParaModificarPrecio,
} from './decision-modificacion-precio';

export interface ReservaParaProponerPrecio extends ReservaParaModificarPrecio {
  trabajadorId: string;
  servicioEnPrestacion: boolean;
}

export interface DatosPropuestaPrecio {
  variacion: number;
  motivo: string;
  propuestaEn: Date;
}

export interface PropuestaPrecioNueva extends Omit<PropuestaPrecio, 'id'> {
  proponenteId: string;
  motivo: string;
  propuestaEn: Date;
  decisionRegistrada: null;
}

export interface PropuestaPrecioGuardada extends PropuestaPrecioNueva {
  id: string;
}

export function crearPropuestaPrecio(
  reserva: ReservaParaProponerPrecio,
  actorId: string,
  datos: DatosPropuestaPrecio,
): PropuestaPrecioNueva {
  if (actorId !== reserva.trabajadorId) {
    throw new Error('Solo el trabajador contratado puede proponer un cambio.');
  }

  if (!reserva.servicioEnPrestacion) {
    throw new Error('El servicio debe estar en prestacion.');
  }

  const motivo = datos.motivo.trim();
  if (motivo.length === 0) {
    throw new Error('El motivo es obligatorio.');
  }

  if (!Number.isSafeInteger(datos.variacion) || datos.variacion === 0) {
    throw new Error('La variacion debe ser un entero distinto de cero en centavos.');
  }

  const precioPropuesto = reserva.precioVigente + datos.variacion;
  if (!Number.isSafeInteger(precioPropuesto) || precioPropuesto <= 0) {
    throw new Error('El precio propuesto queda fuera del rango admitido.');
  }

  return {
    reservaId: reserva.id,
    variacion: datos.variacion,
    motivo,
    proponenteId: actorId,
    propuestaEn: datos.propuestaEn,
    decisionRegistrada: null,
  };
}