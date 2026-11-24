import {
  decidirModificacionPrecio,
  type DecisionPrecio,
} from '../CORE/decision-modificacion-precio';
import type {
  ModificacionPrecioRepository,
} from '../CORE/modificacion-precio.repository';
import { crearPropuestaPrecio } from '../CORE/propuesta-modificacion-precio';

export class ModificacionPrecioService {
  constructor(private readonly repositorio: ModificacionPrecioRepository) {}

  proponer(
    reservaId: string,
    trabajadorId: string,
    variacion: number,
    motivo: string,
  ) {
    return this.repositorio.enReserva(reservaId, async (operaciones) => {
      const reserva = await operaciones.obtenerReserva();
      if (!reserva) {
        throw new Error('No se encontro la reserva.');
      }

      const propuesta = crearPropuestaPrecio(reserva, trabajadorId, {
        variacion,
        motivo,
        propuestaEn: new Date(),
      });

      return operaciones.guardarPropuesta(propuesta);
    });
  }

  decidir(
    reservaId: string,
    propuestaId: string,
    clienteId: string,
    decision: DecisionPrecio,
  ) {
    if (decision !== 'ACEPTADA' && decision !== 'RECHAZADA') {
      throw new Error('La decision debe ser ACEPTADA o RECHAZADA.');
    }

    return this.repositorio.enReserva(reservaId, async (operaciones) => {
      const reserva = await operaciones.obtenerReserva();
      if (!reserva) {
        throw new Error('No se encontro la reserva.');
      }

      const propuesta = await operaciones.buscarPropuesta(propuestaId);
      if (!propuesta) {
        throw new Error('No se encontro la propuesta en esta reserva.');
      }

      if (!reserva.servicioEnPrestacion) {
        throw new Error('El servicio debe estar en prestacion para decidir.');
      }

      const resultado = decidirModificacionPrecio(
        reserva,
        propuesta,
        clienteId,
        decision,
      );

      await operaciones.guardarDecision({
        actorId: clienteId,
        decididaEn: new Date(),
        resultado,
      });

      return resultado;
    });
  }
}