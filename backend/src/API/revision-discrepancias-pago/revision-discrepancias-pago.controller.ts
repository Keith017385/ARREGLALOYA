import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  NotFoundException,
  Param,
  Post,
  ForbiddenException,
  Get,
  Header,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { RevisionDiscrepanciasPagoService } from '../../SERVICE/revision-discrepancias-pago/revision-discrepancias-pago.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

@Controller('administracion/discrepancias-pago')
export class RevisionDiscrepanciasPagoController {
  constructor(private readonly servicio: RevisionDiscrepanciasPagoService) {}

  @Get()
  @Header('Cache-Control', 'no-store')
  async listar(@Req() solicitud: SolicitudAutenticada) {
    const actorId = this.obtenerActor(solicitud);

    try {
      return await this.servicio.listarPendientes(actorId);
    } catch (error) {
      if (error instanceof Error && error.message === 'Se requiere un administrador activo.') {
        throw new ForbiddenException(error.message);
      }
      throw error;
    }
  }

  @Post(':pagoId/resolucion')
  async resolver(
    @Req() solicitud: SolicitudAutenticada,
    @Param('pagoId') pagoId: string,
    @Body() cuerpo: { resultado?: unknown; motivo?: unknown } | undefined,
  ) {
    const actorId = this.obtenerActor(solicitud);
    if (!this.esIdValido(pagoId)) {
      throw new BadRequestException('El identificador del pago no es valido.');
    }

    try {
      return await this.servicio.resolver(pagoId, actorId, cuerpo?.resultado, cuerpo?.motivo);
    } catch (error) {
      if (!(error instanceof Error)) {
        throw error;
      }

      switch (error.message) {
        case 'Se requiere un administrador activo.':
        case 'Se requiere administrador activo':
          throw new ForbiddenException('Se requiere un administrador activo.');
        case 'No se encontro el pago directo.':
          throw new NotFoundException(error.message);
        case 'Selecciona un resultado valido para la resolucion del pago.':
        case 'El motivo debe tener entre 1 y 2000 caracteres.':
        case 'El motivo debe tener entre 1 y 2000 caracteres y ser un texto valido.':
          throw new BadRequestException(error.message);
        case 'El pago ya tiene una resolucion.':
        case 'El pago no tiene una discrepancia pendiente de resolucion.':
        case 'El importe declarado no se puede acreditar con el estado y saldo vigentes.':
        case 'El pago ya no esta disponible para confirmacion.':
          throw new ConflictException(error.message);
        default:
          throw error;
      }
    }
  }

  private obtenerActor(solicitud: SolicitudAutenticada): string {
    const actorId = solicitud.user?.usuarioId;
    if (!this.esIdValido(actorId)) {
      throw new UnauthorizedException('Inicia sesion para gestionar las discrepancias.');
    }
    return actorId;
  }

  private esIdValido(valor: unknown): valor is string {
    return typeof valor === 'string'
      && /^[1-9][0-9]{0,18}$/.test(valor)
      && BigInt(valor) <= 9223372036854775807n;
  }
}
