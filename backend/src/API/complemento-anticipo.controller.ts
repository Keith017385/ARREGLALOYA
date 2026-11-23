import {
  BadRequestException,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { PostgresComplementoAnticipoRepository } from '../INFRASTRUCTURE/postgres-complemento-anticipo.repository';
import { PostgresInicioComplementoAnticipoRepository } from '../INFRASTRUCTURE/postgres-inicio-complemento-anticipo.repository';

interface SolicitudConUsuario {
  user?: { usuarioId?: unknown };
}

function esIdValido(valor: unknown): valor is string {
  return (
    typeof valor === 'string' &&
    /^[1-9]\d{0,18}$/.test(valor) &&
    BigInt(valor) <= 9223372036854775807n
  );
}

function leerCliente(solicitud: SolicitudConUsuario): string {
  const usuarioId = solicitud.user?.usuarioId;
  if (!esIdValido(usuarioId)) {
    throw new UnauthorizedException('Inicia sesión para continuar.');
  }
  return usuarioId;
}

function validarReservaId(reservaId: string): void {
  if (!esIdValido(reservaId)) {
    throw new BadRequestException('reservaId debe ser un ID numérico válido.');
  }
}

@Controller('reservas/:reservaId/complemento-anticipo')
export class ComplementoAnticipoController {
  constructor(
    private readonly consulta: PostgresComplementoAnticipoRepository,
    private readonly inicio: PostgresInicioComplementoAnticipoRepository,
  ) {}

  @Get()
  async consultar(
    @Req() solicitud: SolicitudConUsuario,
    @Param('reservaId') reservaId: string,
  ) {
    const clienteId = leerCliente(solicitud);
    validarReservaId(reservaId);

    const resultado = await this.consulta.consultar(reservaId, clienteId);
    if (!resultado) {
      throw new NotFoundException('El complemento no está disponible para esta reserva.');
    }

    return resultado;
  }

  @Post('solicitudes')
  async iniciar(
    @Req() solicitud: SolicitudConUsuario,
    @Param('reservaId') reservaId: string,
  ) {
    const clienteId = leerCliente(solicitud);
    validarReservaId(reservaId);

    try {
      return await this.inicio.iniciar(reservaId, clienteId);
    } catch (error: unknown) {
      if (error instanceof Error) {
        switch (error.message) {
          case 'La reserva no pertenece al cliente.':
            throw new ForbiddenException('No puedes iniciar el cobro de esta reserva.');
          case 'No hay un complemento cobrable para esta reserva.':
            throw new ConflictException('No hay un complemento cobrable para esta reserva.');
          case 'Ya hay un cobro en curso para esta reserva.':
            throw new ConflictException('Ya hay un cobro en curso para esta reserva.');
        }
      }
      throw error;
    }
  }
}