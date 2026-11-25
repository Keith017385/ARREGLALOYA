import { Body, Controller, Get, Param, Post, Put, Req, UnauthorizedException } from '@nestjs/common';
import { CambiosSolicitud, NuevaSolicitud } from '../CORE/solicitudes';
import { ReservaInicialService } from '../SERVICE/reserva-inicial.service';
import { SeleccionTrabajadorService } from '../SERVICE/seleccion-trabajador.service';
import { CotizacionesService } from '../SERVICE/cotizaciones.service';
import { SolicitudesService } from '../SERVICE/solicitudes.service';

interface SolicitudAutenticada {
  user?: { usuarioId: string };
}

@Controller('solicitudes')
export class SolicitudesController {
  constructor(private readonly servicio: SolicitudesService, private readonly cotizaciones: CotizacionesService, private readonly reservas: ReservaInicialService, private readonly seleccion: SeleccionTrabajadorService) {}

  private cliente(req: SolicitudAutenticada): string {
    if (!req.user) throw new UnauthorizedException('Inicia sesión para continuar.');
    return req.user.usuarioId;
  }

  @Get()
  listar(@Req() req: SolicitudAutenticada) {
    return this.servicio.listar(this.cliente(req));
  }

  @Get('zonas')
  zonas(@Req() req: SolicitudAutenticada) {
    return this.servicio.opciones(this.cliente(req));
  }

  @Get(':solicitudId/historial')
  historial(@Req() req: SolicitudAutenticada, @Param('solicitudId') solicitudId: string) {
    return this.servicio.historial(this.cliente(req), solicitudId);
  }

  @Put(':solicitudId')
  modificar(@Req() req: SolicitudAutenticada, @Param('solicitudId') solicitudId: string, @Body() cuerpo?: Partial<CambiosSolicitud>) {
    return this.servicio.modificar(this.cliente(req), solicitudId, cuerpo);
  }

  @Get(':solicitudId/trabajadores')
  trabajadores(@Req() req: SolicitudAutenticada, @Param('solicitudId') solicitudId: string) {
    return this.seleccion.buscar(this.cliente(req), solicitudId);
  }

  @Post(':solicitudId/seleccion')
  seleccionar(@Req() req: SolicitudAutenticada, @Param('solicitudId') solicitudId: string, @Body('trabajadorId') trabajadorId: unknown) {
    return this.seleccion.seleccionar(this.cliente(req), solicitudId, trabajadorId);
  }

  @Get(':solicitudId/ofertas')
  ofertas(@Req() req: SolicitudAutenticada, @Param('solicitudId') solicitudId: string) {
    return this.cotizaciones.listar(this.cliente(req), solicitudId);
  }

  @Post(':solicitudId/cotizaciones/:cotizacionId/decision')
  decidir(
    @Req() req: SolicitudAutenticada,
    @Param('solicitudId') solicitudId: string,
    @Param('cotizacionId') cotizacionId: string,
    @Body('decision') decision: unknown,
  ) {
    return this.cotizaciones.decidir(this.cliente(req), solicitudId, cotizacionId, decision);
  }

  @Get('cotizaciones/:cotizacionId/reserva')
  consultarReserva(@Req() req: SolicitudAutenticada, @Param('cotizacionId') cotizacionId: string) {
    return this.reservas.consultar(this.cliente(req), cotizacionId);
  }

  @Post('cotizaciones/:cotizacionId/reserva')
  crearReserva(@Req() req: SolicitudAutenticada, @Param('cotizacionId') cotizacionId: string, @Body('inicio') inicio: unknown) {
    return this.reservas.crear(this.cliente(req), cotizacionId, inicio);
  }

  @Post()
  publicar(@Req() req: SolicitudAutenticada, @Body() datos: Partial<NuevaSolicitud> | undefined) {
    return this.servicio.publicar(this.cliente(req), datos);
  }
}
