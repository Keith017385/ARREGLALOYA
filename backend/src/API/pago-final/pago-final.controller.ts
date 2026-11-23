import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  HttpCode,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UnprocessableEntityException,
} from '@nestjs/common';
import { PagoFinalService } from '../../SERVICE/pago-final/pago-final.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

const MAX_BIGINT_POSTGRES = 9223372036854775807n;

function esIdValido(valor: unknown): valor is string {
  return typeof valor === 'string'
    && /^[1-9][0-9]{0,18}$/.test(valor)
    && BigInt(valor) <= MAX_BIGINT_POSTGRES;
}

function obtenerActor(solicitud: SolicitudAutenticada): string {
  const id = solicitud.user?.usuarioId;
  if (!esIdValido(id)) {
    throw new UnauthorizedException('Inicia sesion para continuar.');
  }
  return id;
}

function validarId(id: string, nombre: string): void {
  if (!esIdValido(id)) {
    throw new BadRequestException(`El identificador de ${nombre} no es valido.`);
  }
}

function traducirError(error: unknown): never {
  if (!(error instanceof Error)) {
    throw error;
  }

  switch (error.message) {
    case 'No se encontro la reserva.':
    case 'No se encontro el pago en esta reserva.':
      throw new NotFoundException(error.message);
    case 'Solo el cliente de la reserva puede declarar el pago.':
    case 'Solo el trabajador contratado puede confirmar el pago.':
      throw new ForbiddenException(error.message);
    case 'El pago final debe coincidir con el saldo pendiente.':
      throw new UnprocessableEntityException(error.message);
    case 'Solo los participantes de la reserva pueden consultar el pago.':
    case 'Solo los participantes de la reserva pueden solicitar revision.':
      throw new ForbiddenException(error.message);
    case 'La declaracion debe tener entre 1 y 2000 caracteres.':
    case 'El importe reportado debe ser un entero no negativo en centavos.':
      throw new BadRequestException(error.message);
    case 'La reserva debe estar finalizada para declarar el pago.':
    case 'La reserva debe estar finalizada para confirmar el pago.':
    case 'Hay una modificacion de precio pendiente de decision.':
    case 'Ya hay un pago declarado pendiente de confirmacion.':
    case 'El saldo requiere revision por exceso de pago.':
    case 'La reserva no tiene saldo pendiente.':
    case 'Ya solicitaste revision de este pago.':
    case 'La reserva no tiene una finalizacion registrada.':
    case 'Vencio el plazo para solicitar revision del pago.':
    case 'El pago esta pendiente de revision administrativa.':
    case 'El pago ya fue confirmado.':
    case 'El pago ya no esta pendiente de confirmacion.':
    case 'El pago declarado ya no coincide con el saldo vigente.':
      throw new ConflictException(error.message);
    default:
      throw error;
  }
}

@Controller('reservas/:reservaId/pagos-directos')
export class PagoFinalController {
  constructor(private readonly servicio: PagoFinalService) {}

  @Get()
  async consultarEstado(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reservaId, 'reserva');
    try {
      return await this.servicio.consultarEstado(reservaId, actorId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post()
  async declarar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
    @Body() cuerpo: { importeCentavos?: unknown } | undefined,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reservaId, 'reserva');

    const importe = cuerpo?.importeCentavos;
    if (typeof importe !== 'number' || !Number.isSafeInteger(importe) || importe <= 0) {
      throw new BadRequestException('El importe debe ser un entero positivo en centavos.');
    }

    try {
      return await this.servicio.declarar(reservaId, actorId, importe);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post(':pagoId/discrepancias')
  async solicitarRevision(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
    @Param('pagoId') pagoId: string,
    @Body() cuerpo: { declaracion?: unknown; importeCentavos?: unknown } | undefined,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reservaId, 'reserva');
    validarId(pagoId, 'pago');

    const declaracion = cuerpo?.declaracion;
    if (typeof declaracion !== 'string') {
      throw new BadRequestException('Escribe una declaracion para solicitar revision.');
    }

    const importe = cuerpo?.importeCentavos;
    if (importe != null
        && (typeof importe !== 'number' || !Number.isSafeInteger(importe) || importe < 0)) {
      throw new BadRequestException('El importe reportado debe ser un entero no negativo en centavos.');
    }

    try {
      return await this.servicio.solicitarRevision(
        reservaId, pagoId, actorId, declaracion, importe ?? null,
      );
    } catch (error) {
      traducirError(error);
    }
  }

  @Post(':pagoId/confirmacion')
  @HttpCode(200)
  async confirmar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('reservaId') reservaId: string,
    @Param('pagoId') pagoId: string,
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(reservaId, 'reserva');
    validarId(pagoId, 'pago');

    try {
      return await this.servicio.confirmar(reservaId, pagoId, actorId);
    } catch (error) {
      traducirError(error);
    }
  }
}
