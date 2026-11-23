import { prepararDescripcionIncidente, prepararSancion } from '../../CORE/incidentes-sanciones/incidentes-sanciones';
import type { IncidentesSancionesRepository } from '../../CORE/incidentes-sanciones/incidentes-sanciones.repository';

export class IncidentesSancionesService {
  constructor(private readonly repositorio: IncidentesSancionesRepository) {}

  async consultarIncidente(incidenteId: string, actorId: string) {
    const resultado = await this.repositorio.consultarIncidente(incidenteId, actorId);

    switch (resultado.estado) {
      case 'sin_permiso':
        throw new Error('Se requiere un administrador activo.');
      case 'incidente_inexistente':
        throw new Error('No se encontro el incidente.');
      case 'encontrado':
        return resultado.incidente;
    }
  }

  async confirmarIncidente(incidenteId: string, actorId: string) {
    const resultado = await this.repositorio.confirmarIncidente(incidenteId, actorId);

    switch (resultado.estado) {
      case 'sin_permiso':
        throw new Error('Se requiere un administrador activo.');
      case 'incidente_inexistente':
        throw new Error('No se encontro el incidente.');
      case 'ya_confirmado':
        throw new Error('El incidente ya esta confirmado.');
      case 'confirmado':
        return resultado;
    }
  }

  async registrarSancion(
    incidenteId: string,
    usuarioId: string,
    actorId: string,
    motivo: unknown,
    inicio: Date,
    fin: Date,
  ) {
    const datos = prepararSancion(motivo, inicio, fin);
    const resultado = await this.repositorio.registrarSancion(
      incidenteId, usuarioId, actorId, datos,
    );

    switch (resultado.estado) {
      case 'sin_permiso':
        throw new Error('Se requiere un administrador activo.');
      case 'incidente_inexistente':
        throw new Error('No se encontro el incidente.');
      case 'incidente_no_confirmado':
        throw new Error('Confirma el incidente antes de registrar una sancion.');
      case 'usuario_no_vinculado':
        throw new Error('El usuario no esta vinculado al incidente.');
      case 'registrada':
        return resultado.sancion;
    }
  }

  async registrarIncidente(reservaId: string, actorId: string, descripcion: unknown) {
    const texto = prepararDescripcionIncidente(descripcion);
    const resultado = await this.repositorio.registrarIncidente(reservaId, actorId, texto);

    switch (resultado.estado) {
      case 'sin_permiso':
        throw new Error('Se requiere un administrador activo.');
      case 'reserva_inexistente':
        throw new Error('No se encontro la reserva.');
      case 'registrado':
        return resultado.incidente;
    }
  }
}
