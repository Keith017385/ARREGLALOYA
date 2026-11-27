import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DatosDictamen, ResultadoAsistencia } from '../CORE/dictamen-asistencia';
import { DictamenAsistenciaService } from '../SERVICE/dictamen-asistencia.service';

function validarId(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^\d{1,19}$/.test(valor)) {
    throw new BadRequestException(`${campo} no es válido.`);
  }
  return valor;
}

function validarDictamen(respuestaId: string, body: unknown): DatosDictamen {
  if (typeof body !== 'object' || body === null) throw new BadRequestException('Datos no válidos.');
  const b = body as Record<string, unknown>;
  const resultado = b.resultado;
  if (resultado !== 'trabajador_asistio' && resultado !== 'trabajador_no_asistio') {
    throw new BadRequestException('El resultado no es válido.');
  }
  if (typeof b.explicacion !== 'string' || b.explicacion.trim() === '') {
    throw new BadRequestException('La explicación es obligatoria.');
  }
  const explicacion = b.explicacion.trim();
  if (explicacion.length > 1900) throw new BadRequestException('La explicación es demasiado larga.');
  return {
    respuestaId: validarId(respuestaId, 'El caso'),
    responsableId: validarId(String(b.responsableId ?? ''), 'El responsable'),
    resultado: resultado as ResultadoAsistencia,
    explicacion,
  };
}

@Controller('superadministracion/dictamenes-asistencia')
export class DictamenAsistenciaController {
  constructor(private readonly servicio: DictamenAsistenciaService) {}

  @Get()
  listar() {
    return this.servicio.listarAbiertos();
  }

  @Post(':respuestaId')
  dictaminar(@Param('respuestaId') respuestaId: string, @Body() body: unknown) {
    return this.servicio.dictaminar(validarDictamen(respuestaId, body));
  }
}