import { calcularVistaPreviaCancelacion } from '../../CORE/cancelacion-cliente/cancelacion-cliente';
import type { CancelacionClienteRepository, LiquidacionCancelacionCliente } from '../../CORE/cancelacion-cliente/cancelacion-cliente.repository';

export class CancelacionClienteService {
  constructor(private readonly repositorio: CancelacionClienteRepository) {}

  async confirmar(
    reservaId: string,
    clienteId: string,
    motivo: unknown,
    esperada: LiquidacionCancelacionCliente,
  ) {
    if (typeof motivo !== 'string' || !motivo.trim()) {
      throw new Error('El motivo de cancelacion es obligatorio.');
    }

    if (!esperada || (esperada.causal !== 'cliente_anticipada' && esperada.causal !== 'cliente_tardia')) {
      throw new Error('Confirma con una vista previa valida.');
    }

    const importes = [
      esperada.fondoCentavos,
      esperada.comisionCentavos,
      esperada.reembolsoCentavos,
      esperada.compensacionTrabajadorCentavos,
      esperada.repartoPlataformaCentavos,
    ];

    if (importes.some((importe) => !Number.isSafeInteger(importe) || importe < 0)) {
      throw new Error('Confirma con una vista previa valida.');
    }

    return this.repositorio.confirmar(reservaId, clienteId, motivo.trim(), esperada);
  }

  consultarAvisosDelTrabajador(trabajadorId: string) {
    return this.repositorio.consultarAvisosDelTrabajador(trabajadorId);
  }

  async consultarVistaPrevia(reservaId: string, clienteId: string) {
    const contexto = await this.repositorio.consultarContexto(reservaId, clienteId);
    if (!contexto) {
      throw new Error('No se encontro la reserva.');
    }

    if (contexto.estado !== 'pendiente_anticipo' && contexto.estado !== 'reservada') {
      throw new Error('La reserva no esta disponible para cancelacion por el cliente.');
    }

    if (contexto.requiereConciliacion) {
      throw new Error('Hay compromisos o movimientos abiertos que deben conciliarse antes de cancelar.');
    }

    const resultado = calcularVistaPreviaCancelacion(
      contexto.inicioProgramado,
      contexto.consultadaEn,
      contexto.fondoCentavos,
    );

    return {
      reservaId,
      inicioProgramado: contexto.inicioProgramado,
      consultadaEn: contexto.consultadaEn,
      fondoCentavos: contexto.fondoCentavos,
      comisionCentavos: contexto.comisionCentavos,
      ...resultado,
    };
  }
}
