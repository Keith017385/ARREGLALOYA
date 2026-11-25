export interface TrabajadorDisponible {
  id: string;
  nombre: string;
  zona: string;
  opiniones: number;
  puntuacion: string | null;
  seleccionado: boolean;
}

export abstract class SeleccionTrabajadorRepository {
  abstract buscar(clienteId: string, solicitudId: string): Promise<TrabajadorDisponible[] | null>;
  abstract seleccionar(clienteId: string, solicitudId: string, trabajadorId: string):
    Promise<'seleccionado' | 'no-encontrada' | 'no-disponible'>;
}
