import type {
  ConsultaComplementoAnticipoRepository,
  InicioComplementoAnticipoRepository,
} from '../CORE/complemento-anticipo.repository';

/** Coordina el caso de uso; no conoce SQL ni el paquete pg. */
export class ComplementoAnticipoService {
  constructor(
    private readonly consultaRepositorio: ConsultaComplementoAnticipoRepository,
    private readonly inicioRepositorio: InicioComplementoAnticipoRepository,
  ) {}

  consultar(reservaId: string, clienteId: string) {
    return this.consultaRepositorio.consultar(reservaId, clienteId);
  }

  iniciar(reservaId: string, clienteId: string) {
    return this.inicioRepositorio.iniciar(reservaId, clienteId);
  }
}
