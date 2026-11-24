import type {
  CancelacionTrabajadorRepository,
  ContextoCancelacionTrabajador,
  VistaPreviaCancelacionTrabajador,
} from '../../CORE/cancelacion-trabajador/cancelacion-trabajador.repository';

const ESTADOS_CANCELABLES = new Set(['pendiente_anticipo', 'reservada', 'en_ejecucion']);

function validarImporteCentavos(valor: unknown): valor is number {
  return typeof valor === 'number' && Number.isSafeInteger(valor) && valor >= 0;
}

export class CancelacionTrabajadorService {
  constructor(private readonly repositorio: CancelacionTrabajadorRepository) {}

  async consultarVistaPrevia(reservaId: string, trabajadorId: string) {
    const contexto = await this.repositorio.consultarContexto(reservaId, trabajadorId);
    this.validarContexto(contexto, trabajadorId);

    return {
      reservaId,
      estado: contexto.estado,
      inicioProgramado: contexto.inicioProgramado.toISOString(),
      reembolsoCentavos: contexto.reembolsoCentavos,
      desembolsosPreviosCentavos: contexto.desembolsosPreviosCentavos,
    } satisfies VistaPreviaCancelacionTrabajador;
  }

  async confirmar(
    reservaId: string,
    trabajadorId: string,
    motivo: unknown,
    vistaPrevia: VistaPreviaCancelacionTrabajador,
  ) {
    if (typeof motivo !== 'string' || !motivo.trim()) {
      throw new Error('El motivo de cancelacion es obligatorio.');
    }

    if (!this.esVistaPreviaValida(reservaId, vistaPrevia)) {
      throw new Error('Confirma con una vista previa valida.');
    }

    return this.repositorio.confirmar(
      reservaId,
      trabajadorId,
      motivo.trim(),
      vistaPrevia,
    );
  }

  private validarContexto(
    contexto: ContextoCancelacionTrabajador | null,
    trabajadorId: string,
  ): asserts contexto is ContextoCancelacionTrabajador {
    if (!contexto) {
      throw new Error('No se encontro la reserva.');
    }
    if (!contexto.rolTrabajadorActivo) {
      throw new Error('El usuario no tiene un rol de trabajador activo.');
    }
    if (contexto.trabajadorId !== trabajadorId) {
      throw new Error('El usuario no corresponde al trabajador contratado.');
    }
    if (!ESTADOS_CANCELABLES.has(contexto.estado)) {
      throw new Error('La reserva no esta disponible para cancelacion por el trabajador.');
    }
    if (contexto.requiereConciliacion) {
      throw new Error('Hay compromisos o movimientos abiertos que deben conciliarse antes de cancelar.');
    }
    if (!validarImporteCentavos(contexto.reembolsoCentavos)
        || !validarImporteCentavos(contexto.desembolsosPreviosCentavos)) {
      throw new Error('PostgreSQL devolvio importes invalidos para la cancelacion.');
    }
  }

  private esVistaPreviaValida(
    reservaId: string,
    vistaPrevia: VistaPreviaCancelacionTrabajador,
  ): boolean {
    if (!vistaPrevia || vistaPrevia.reservaId !== reservaId) {
      return false;
    }
    if (!ESTADOS_CANCELABLES.has(vistaPrevia.estado)) {
      return false;
    }
    if (typeof vistaPrevia.inicioProgramado !== 'string'
        || !Number.isFinite(Date.parse(vistaPrevia.inicioProgramado))) {
      return false;
    }
    return validarImporteCentavos(vistaPrevia.reembolsoCentavos)
      && validarImporteCentavos(vistaPrevia.desembolsosPreviosCentavos);
  }
}
