import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Header,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { EmisionCodigoService } from '../../SERVICE/finalizacion-servicio/emision-codigo.service';
import { FinalizacionService } from '../../SERVICE/finalizacion-servicio/finalizacion.service';

import { PostgresInicioServicioRepository } from '../../INFRASTRUCTURE/finalizacion-servicio/postgres-inicio-servicio.repository';

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

function leerActor(solicitud: SolicitudConUsuario): string {
  const usuarioId = solicitud.user?.usuarioId;
  if (!esIdValido(usuarioId)) {
    throw new UnauthorizedException('Inicia sesión para continuar.');
  }
  return usuarioId;
}

function validarReservaId(reservaId: string): void {
  if (!esIdValido(reservaId)) {
    throw new BadRequestException('El ID de reserva debe ser numérico.');
  }
}

async function ejecutar<T>(operacion: () => Promise<T>): Promise<T> {
  try {
    return await operacion();
  } catch (error: unknown) {
    if (error instanceof Error) {
      const postgres = error as Error & { code?: string; constraint?: string };
      if (
        postgres.code === '23505' &&
        postgres.constraint === 'finalizacion_codigo_id_key'
      ) {
        throw new ConflictException('El código ya fue utilizado.');
      }

      switch (error.message) {
        case 'No se encontro la reserva.':
          throw new NotFoundException('No se encontró la reserva.');

        case 'Solo el trabajador contratado puede solicitar el codigo.':
        case 'Solo el cliente de la reserva puede confirmar la finalizacion.':
          throw new ForbiddenException('No puedes realizar esta acción en la reserva.');

        case 'El codigo no es valido para esta reserva.':
        case 'Ingresa el codigo de finalizacion.':
          throw new BadRequestException('El código de finalización no es válido.');

        case 'El codigo ya fue utilizado.':
          throw new ConflictException('El código ya fue utilizado.');

        case 'La reserva debe estar en ejecucion para generar un codigo.':
        case 'La reserva debe estar en ejecucion para finalizar.':
          throw new ConflictException('La reserva debe estar en ejecución.');
      }
    }

    throw error;
  }
}

@Controller('reservas/:reservaId/finalizacion')
export class FinalizacionController {
  constructor(
    private readonly emision: EmisionCodigoService,
    private readonly finalizacion: FinalizacionService,
    private readonly inicio: PostgresInicioServicioRepository,
  ) {}

  @Post('inicio')
  iniciar(@Req() solicitud: SolicitudConUsuario, @Param('reservaId') reservaId: string) {
    const trabajadorId = leerActor(solicitud);
    validarReservaId(reservaId);
    return this.inicio.iniciar(reservaId, trabajadorId);
  }

  @Post('codigos')
  @Header('Cache-Control', 'no-store')
  emitir(
    @Req() solicitud: SolicitudConUsuario,
    @Param('reservaId') reservaId: string,
  ) {
    const trabajadorId = leerActor(solicitud);
    validarReservaId(reservaId);

    return ejecutar(() => this.emision.emitir(reservaId, trabajadorId));
  }

  @Post('confirmacion')
  confirmar(
    @Req() solicitud: SolicitudConUsuario,
    @Param('reservaId') reservaId: string,
    @Body() datos: { codigo?: unknown } | undefined,
  ) {
    const clienteId = leerActor(solicitud);
    validarReservaId(reservaId);

    const codigo = datos?.codigo;
    if (
      typeof codigo !== 'string' ||
      !/^[A-Za-z0-9_-]{32}$/.test(codigo.trim())
    ) {
      throw new BadRequestException('El código de finalización no es válido.');
    }

    return ejecutar(() =>
      this.finalizacion.confirmar(reservaId, clienteId, codigo),
    );
  }
}