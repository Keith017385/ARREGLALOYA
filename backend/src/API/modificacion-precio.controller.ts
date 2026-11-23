import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { ModificacionPrecioService } from '../SERVICE/modificacion-precio.service';

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

function validarId(valor: string, nombre: string): void {
  if (!esIdValido(valor)) {
    throw new BadRequestException(`${nombre} debe ser un ID numérico válido.`);
  }
}

async function ejecutarOperacion<T>(
  operacion: () => Promise<T>,
): Promise<T> {
  try {
    return await operacion();
  } catch (error: unknown) {
    if (!(error instanceof Error)) {
      throw error;
    }

    const postgres = error as Error & { code?: string; constraint?: string };

    if (
      postgres.code === '23505' &&
      postgres.constraint === 'decision_modificacion_modificacion_id_key'
    ) {
      throw new ConflictException('La propuesta ya tiene una decisión registrada.');
    }

    switch (error.message) {
      case 'Solo el trabajador contratado puede proponer un cambio.':
      case 'Solo el cliente de la reserva puede decidir.':
      case 'Proponente ajeno a la contratación':
      case 'Aceptación de un cliente ajeno':
        throw new ForbiddenException(
          'No tienes permiso para actuar sobre esta modificación de precio.',
        );

      case 'No se encontro la reserva.':
        throw new NotFoundException('No se encontró la reserva.');

      case 'No se encontro la propuesta en esta reserva.':
        throw new NotFoundException('No se encontró la propuesta en esta reserva.');

      case 'La propuesta ya tiene una decisión registrada.':
        throw new ConflictException('La propuesta ya tiene una decisión registrada.');

      case 'El servicio debe estar en prestacion.':
      case 'El servicio debe estar en prestacion para decidir.':
      case 'Reserva cerrada':
        throw new ConflictException(
          'Solo se puede modificar el precio mientras el servicio está en ejecución.',
        );

      case 'El precio propuesto queda fuera del rango admitido.':
      case 'El precio final debe ser mayor que cero.':
      case 'Precio final no positivo':
        throw new BadRequestException('La variación debe dejar un precio válido.');

      default:
        throw error;
    }
  }
}

@Controller('reservas/:reservaId/modificaciones-precio')
export class ModificacionPrecioController {
  constructor(private readonly servicio: ModificacionPrecioService) {}

  @Post()
  proponer(
    @Req() solicitud: SolicitudConUsuario,
    @Param('reservaId') reservaId: string,
    @Body() datos: { variacion?: unknown; motivo?: unknown } | undefined,
  ) {
    const trabajadorId = leerActor(solicitud);
    validarId(reservaId, 'reservaId');

    const variacion = datos?.variacion;
    const motivo = datos?.motivo;

    if (
      typeof variacion !== 'number' ||
      !Number.isSafeInteger(variacion) ||
      variacion === 0
    ) {
      throw new BadRequestException(
        'La variación debe ser un entero distinto de cero en centavos.',
      );
    }

    if (typeof motivo !== 'string' || motivo.trim() === '') {
      throw new BadRequestException('El motivo es obligatorio.');
    }

    return ejecutarOperacion(() =>
      this.servicio.proponer(reservaId, trabajadorId, variacion, motivo),
    );
  }

  @Post(':propuestaId/decision')
  decidir(
    @Req() solicitud: SolicitudConUsuario,
    @Param('reservaId') reservaId: string,
    @Param('propuestaId') propuestaId: string,
    @Body() datos: { decision?: unknown } | undefined,
  ) {
    const clienteId = leerActor(solicitud);
    validarId(reservaId, 'reservaId');
    validarId(propuestaId, 'propuestaId');

    const decision = datos?.decision;

    if (decision !== 'ACEPTADA' && decision !== 'RECHAZADA') {
      throw new BadRequestException('La decisión debe ser ACEPTADA o RECHAZADA.');
    }

    return ejecutarOperacion(() =>
      this.servicio.decidir(reservaId, propuestaId, clienteId, decision),
    );
  }
}