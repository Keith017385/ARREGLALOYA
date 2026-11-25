import { UseGuards } from '@nestjs/common';
import { PropietarioTrabajadorGuard } from './propietario-trabajador.guard';
import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { OfertasTrabajadorRepository } from '../CORE/ofertas-trabajador';
import { SolicitudDisponibleService } from '../SERVICE/solicitud-disponible.service';

// Un id válido son solo dígitos (bigint de PostgreSQL, máximo 19).
function validarId(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^[1-9][0-9]{0,18}$/.test(valor) || BigInt(valor) > 9223372036854775807n) {
    throw new BadRequestException(`${campo} no es válido.`);
  }
  return valor;
}

function fechaFutura(valor: unknown): Date {
  const fecha = typeof valor === 'string' ? new Date(valor) : new Date(NaN);
  if (!Number.isFinite(fecha.getTime()) || fecha.getTime() <= Date.now()) {
    throw new BadRequestException('Selecciona una fecha futura.');
  }
  return fecha;
}

function importe(valor: unknown): string {
  if (typeof valor !== 'string' || !/^\d{1,12}(?:\.\d{1,2})?$/.test(valor)) {
    throw new BadRequestException('Introduce importes con un máximo de dos decimales.');
  }
  return valor;
}

@UseGuards(PropietarioTrabajadorGuard)
@Controller('trabajadores')
export class SolicitudDisponibleController {
  constructor(private readonly servicio: SolicitudDisponibleService, private readonly ofertas: OfertasTrabajadorRepository) {}

  @Get(':usuarioId/ofertas')
  listarOfertas(@Param('usuarioId') usuarioId: string) {
    return this.ofertas.listar(usuarioId);
  }

  @Post(':usuarioId/solicitudes/:solicitudId/oferta')
  async presentar(@Param('usuarioId') usuarioId: string, @Param('solicitudId') solicitudId: string) {
    return { id: await this.ofertas.presentar(usuarioId, validarId(solicitudId, 'La solicitud')) };
  }

  @Post(':usuarioId/ofertas/:ofertaId/visita')
  async programar(@Param('usuarioId') usuarioId: string, @Param('ofertaId') ofertaId: string, @Body('fecha') fecha: unknown) {
    return { id: await this.ofertas.programarVisita(usuarioId, validarId(ofertaId, 'La oferta'), fechaFutura(fecha)) };
  }

  @Post(':usuarioId/ofertas/:ofertaId/visita/realizar')
  async realizar(@Param('usuarioId') usuarioId: string, @Param('ofertaId') ofertaId: string) {
    await this.ofertas.registrarVisita(usuarioId, validarId(ofertaId, 'La oferta'));
    return { estado: 'realizada' };
  }

  @Post(':usuarioId/ofertas/:ofertaId/cotizacion')
  async cotizar(@Param('usuarioId') usuarioId: string, @Param('ofertaId') ofertaId: string,
    @Body() datos?: { manoObra?: unknown; materiales?: unknown; transporte?: unknown; venceEn?: unknown }) {
    const manoObra = importe(datos?.manoObra);
    const materiales = importe(datos?.materiales);
    const transporte = importe(datos?.transporte);
    if (Number(manoObra) + Number(materiales) + Number(transporte) <= 0) {
      throw new BadRequestException('La cotización debe tener un importe total positivo.');
    }
    const venceEn = fechaFutura(datos?.venceEn);
    return { id: await this.ofertas.cotizar(usuarioId, validarId(ofertaId, 'La oferta'), { manoObra, materiales, transporte, venceEn }) };
  }

  @Get(':usuarioId/solicitudes')
  listarSolicitudes(@Param('usuarioId') usuarioId: string) {
    return this.servicio.listar(validarId(usuarioId, 'El trabajador'));
  }
}