import { createHash } from 'node:crypto';
import { validarConfirmacionFinalizacion } from '../../CORE/finalizacion-servicio/confirmacion-finalizacion';
import type { FinalizacionRepository } from '../../CORE/finalizacion-servicio/finalizacion.repository';

export class FinalizacionService {
  constructor(private readonly repositorio: FinalizacionRepository) {}

  async confirmar(reservaId: string, clienteId: string, codigoIngresado: string) {
    const codigo = codigoIngresado.trim();
    if (!codigo) {
      throw new Error('Ingresa el codigo de finalizacion.');
    }

    const hash = createHash('sha256').update(codigo, 'utf8').digest('hex');

    return this.repositorio.enReserva(reservaId, async (operaciones) => {
      const reserva = await operaciones.obtenerReserva();
      if (!reserva) {
        throw new Error('No se encontro la reserva.');
      }

      if (reserva.clienteId !== clienteId) {
        throw new Error('Solo el cliente de la reserva puede confirmar la finalizacion.');
      }

      const encontrado = await operaciones.buscarCodigoPorHash(hash);
      validarConfirmacionFinalizacion(reserva, clienteId, encontrado);

      if (!encontrado) {
        throw new Error('El codigo no es valido para esta reserva.');
      }

      const finalizacion = await operaciones.registrarFinalizacion(encontrado.id);
      await operaciones.marcarReservaFinalizada();

      return {
        id: finalizacion.id,
        reservaId: reserva.id,
        estado: 'finalizada' as const,
        confirmadaEn: finalizacion.confirmadaEn,
      };
    });
  }
}