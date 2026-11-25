import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CuentaTrabajador,
  CuentaTrabajadorRepository,
  ResultadoCambioCuenta,
} from '../CORE/cuenta-trabajador';

@Injectable()
export class CuentaTrabajadorService {
  constructor(private readonly repositorio: CuentaTrabajadorRepository) {}

  async obtenerCuenta(usuarioId: string): Promise<CuentaTrabajador> {
    const cuenta = await this.repositorio.obtener(usuarioId);
    if (!cuenta) throw new NotFoundException('Trabajador no encontrado.');
    return cuenta;
  }

  async suspender(usuarioId: string): Promise<CuentaTrabajador> {
    this.revisar(
      await this.repositorio.suspender(usuarioId),
      'Solo una cuenta activa puede suspenderse.',
    );
    return this.obtenerCuenta(usuarioId);
  }

  async reactivar(usuarioId: string): Promise<CuentaTrabajador> {
    this.revisar(
      await this.repositorio.reactivar(usuarioId),
      'Solo una cuenta suspendida voluntariamente puede reactivarse.',
    );
    return this.obtenerCuenta(usuarioId);
  }

  private revisar(resultado: ResultadoCambioCuenta, mensajeConflicto: string): void {
    if (resultado === 'no_encontrado') throw new NotFoundException('Trabajador no encontrado.');
    if (resultado === 'estado_no_permitido') throw new ConflictException(mensajeConflicto);
    if (resultado === 'con_reservas_vigentes') {
      throw new ConflictException('No puedes suspender tu cuenta mientras tengas reservas vigentes.');
    }
  }
}