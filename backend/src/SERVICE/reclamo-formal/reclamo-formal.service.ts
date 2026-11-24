import { prepararReclamo } from '../../CORE/reclamo-formal/reclamo-formal';
import type { ReclamoFormalRepository } from '../../CORE/reclamo-formal/reclamo-formal.repository';

export class ReclamoFormalService {
  constructor(private readonly repositorio: ReclamoFormalRepository) {}

  presentar(reservaId: string, actorId: string, descripcion: unknown) {
    return this.repositorio.enReserva(reservaId, async (operaciones) => {
      const contexto = await operaciones.obtenerContexto();
      if (!contexto) {
        throw new Error('No se encontro la reserva.');
      }

      const texto = prepararReclamo(contexto.reserva, actorId, descripcion, contexto.ahora);
      return operaciones.registrar(actorId, texto, contexto.ahora);
    });
  }

  async consultar(reservaId: string, actorId: string) {
    const reclamos = await this.repositorio.consultarDelCliente(reservaId, actorId);
    if (reclamos === null) {
      throw new Error('No se encontro la reserva.');
    }
    return reclamos;
  }
}
