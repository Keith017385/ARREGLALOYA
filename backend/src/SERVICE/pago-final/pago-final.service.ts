import {
  calcularSaldoDirecto,
  validarDeclaracionPagoFinal,
} from '../../CORE/pago-final/pago-final';
import type { PagoFinalRepository } from '../../CORE/pago-final/pago-final.repository';

import { estaEnPlazoDeDiscrepancia } from '../../CORE/pago-final/plazo-discrepancia';

export class PagoFinalService {
  constructor(private readonly repositorio: PagoFinalRepository) {}

  consultarEstado(reservaId: string, actorId: string) {
    return this.repositorio.enReserva(reservaId, async (operaciones) => {
      const reserva = await operaciones.obtenerReserva();
      if (!reserva) {
        throw new Error('No se encontro la reserva.');
      }
      if (actorId !== reserva.clienteId && actorId !== reserva.trabajadorId) {
        throw new Error('Solo los participantes de la reserva pueden consultar el pago.');
      }

      const { finalizadaEn, ahora } = await operaciones.consultarPlazo();
      const estadoPago = await operaciones.consultarUltimoPago(actorId);
      return {
        reservaId: reserva.id,
        estadoReserva: reserva.estado,
        rol: actorId === reserva.clienteId ? 'cliente' : 'trabajador',
        saldoCentavos: calcularSaldoDirecto(
          reserva.precioFinal,
          reserva.anticipoRecibido,
          reserva.pagosDirectosConfirmados,
        ),
        puedeRegistrarPago: reserva.estado === 'finalizada'
          && !reserva.tieneModificacionPendiente && !reserva.tienePagoPendiente,
        plazoRevisionVigente: reserva.estado === 'finalizada' && finalizadaEn !== null
          && estaEnPlazoDeDiscrepancia(finalizadaEn, ahora),
        ...estadoPago,
      };
    });
  }

  declarar(reservaId: string, clienteId: string, importeCentavos: number) {
    return this.repositorio.enReserva(reservaId, async (operaciones) => {
      const reserva = await operaciones.obtenerReserva();
      if (!reserva) {
        throw new Error('No se encontro la reserva.');
      }

      validarDeclaracionPagoFinal(reserva, clienteId, importeCentavos);
      return operaciones.registrarDeclaracion(importeCentavos);
    });
  }

  solicitarRevision(
    reservaId: string,
    pagoId: string,
    solicitanteId: string,
    declaracion: string,
    importeCentavos: number | null = null,
  ) {
    const texto = declaracion.trim();
    if (!texto || [...texto].length > 2000) {
      throw new Error('La declaracion debe tener entre 1 y 2000 caracteres.');
    }
    if (importeCentavos !== null
        && (!Number.isSafeInteger(importeCentavos) || importeCentavos < 0)) {
      throw new Error('El importe reportado debe ser un entero no negativo en centavos.');
    }

    return this.repositorio.enReserva(reservaId, async (operaciones) => {
      const reserva = await operaciones.obtenerReserva();
      if (!reserva) {
        throw new Error('No se encontro la reserva.');
      }
      if (reserva.clienteId !== solicitanteId && reserva.trabajadorId !== solicitanteId) {
        throw new Error('Solo los participantes de la reserva pueden solicitar revision.');
      }

      const pago = await operaciones.buscarPago(pagoId);
      if (!pago || pago.reservaId !== reserva.id) {
        throw new Error('No se encontro el pago en esta reserva.');
      }
      if (pago.confirmadoEn !== null) {
        throw new Error('El pago ya fue confirmado.');
      }

      const { finalizadaEn, ahora } = await operaciones.consultarPlazo();
      if (reserva.estado !== 'finalizada' || !finalizadaEn) {
        throw new Error('La reserva no tiene una finalizacion registrada.');
      }
      if (!estaEnPlazoDeDiscrepancia(finalizadaEn, ahora)) {
        throw new Error('Vencio el plazo para solicitar revision del pago.');
      }

      return operaciones.registrarDiscrepancia({
        pagoId: pago.id,
        solicitanteId,
        declaracion: texto,
        importeCentavos,
        solicitadaEn: ahora,
      });
    });
  }

  confirmar(reservaId: string, pagoId: string, trabajadorId: string) {
    return this.repositorio.enReserva(reservaId, async (operaciones) => {
      const reserva = await operaciones.obtenerReserva();
      if (!reserva) {
        throw new Error('No se encontro la reserva.');
      }

      if (reserva.trabajadorId !== trabajadorId) {
        throw new Error('Solo el trabajador contratado puede confirmar el pago.');
      }

      const pago = await operaciones.buscarPago(pagoId);
      if (!pago || pago.reservaId !== reserva.id) {
        throw new Error('No se encontro el pago en esta reserva.');
      }

      if (pago.confirmadoEn !== null) {
        throw new Error('El pago ya fue confirmado.');
      }

      if (reserva.estado !== 'finalizada') {
        throw new Error('La reserva debe estar finalizada para confirmar el pago.');
      }

      if (reserva.tieneModificacionPendiente) {
        throw new Error('Hay una modificacion de precio pendiente de decision.');
      }

      const saldo = calcularSaldoDirecto(
        reserva.precioFinal,
        reserva.anticipoRecibido,
        reserva.pagosDirectosConfirmados,
      );

      if (saldo <= 0 || pago.importeCentavos !== saldo) {
        throw new Error('El pago declarado ya no coincide con el saldo vigente.');
      }

      return operaciones.confirmarPago(pago.id);
    });
  }
}