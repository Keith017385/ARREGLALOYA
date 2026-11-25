import { UseGuards } from '@nestjs/common';
import { PropietarioTrabajadorGuard } from './propietario-trabajador.guard';
import { BadRequestException, Body, Controller, Get, Param, Post } from '@nestjs/common';
import { DatosDocumento, TIPOS_DOCUMENTO } from '../CORE/documento-verificacion';
import { DocumentoVerificacionService } from '../SERVICE/documento-verificacion.service';

// Un id válido son solo dígitos (bigint de PostgreSQL, máximo 19).
function validarId(valor: unknown, campo: string): string {
  if (typeof valor !== 'string' || !/^\d{1,19}$/.test(valor)) {
    throw new BadRequestException(`${campo} no es válido.`);
  }
  return valor;
}

function validarDatosDocumento(body: unknown): DatosDocumento {
  if (typeof body !== 'object' || body === null) {
    throw new BadRequestException('Datos del documento no válidos.');
  }
  const b = body as Record<string, unknown>;

  const tipo = typeof b.tipo === 'string' ? b.tipo.trim() : '';
  if ((TIPOS_DOCUMENTO as readonly string[]).indexOf(tipo) === -1) {
    throw new BadRequestException(
      `El tipo de documento no es válido. Usa: ${TIPOS_DOCUMENTO.join(', ')}.`,
    );
  }

  const referenciaArchivo =
    typeof b.referenciaArchivo === 'string' ? b.referenciaArchivo.trim() : '';
  if (referenciaArchivo === '') {
    throw new BadRequestException('El nombre o enlace del archivo es obligatorio.');
  }
  if (referenciaArchivo.length > 300) {
    throw new BadRequestException('El nombre o enlace del archivo es demasiado largo.');
  }

  return { tipo, referenciaArchivo };
}

@UseGuards(PropietarioTrabajadorGuard)
@Controller('trabajadores')
export class DocumentoVerificacionController {
  constructor(private readonly servicio: DocumentoVerificacionService) {}

  @Get(':usuarioId/documentos')
  listarDocumentos(@Param('usuarioId') usuarioId: string) {
    return this.servicio.listar(validarId(usuarioId, 'El trabajador'));
  }

  @Post(':usuarioId/documentos')
  presentarDocumento(@Param('usuarioId') usuarioId: string, @Body() body: unknown) {
    return this.servicio.presentar(
      validarId(usuarioId, 'El trabajador'),
      validarDatosDocumento(body),
    );
  }
}