import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import { DbService } from '../db.service';

@Injectable()
export class PostgresInicioServicioRepository {
  constructor(private readonly db: DbService) {}

  async iniciar(reservaId: string, trabajadorId: string) {
    try {
      await this.db.pool.query('SELECT arreglalo.iniciar_servicio($1, $2)', [reservaId, trabajadorId]);
      return { reservaId, estado: 'en_ejecucion' };
    } catch (error) {
      if (error instanceof Error) {
        if ('code' in error && error.code === 'P0002') throw new NotFoundException('No se encontró la reserva.');
        if (error.message === 'Trabajador ajeno') throw new ForbiddenException('No puedes iniciar esta reserva.');
        if (error.message === 'Reserva no lista para iniciar' || error.message === 'Anticipo insuficiente') {
          throw new ConflictException('La reserva debe estar confirmada con el anticipo acreditado.');
        }
      }
      throw error;
    }
  }
}
