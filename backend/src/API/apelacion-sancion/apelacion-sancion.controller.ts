import {
  BadRequestException,
  Body,
  ConflictException,
  Controller,
  ForbiddenException,
  Get,
  Header,
  NotFoundException,
  Param,
  Post,
  Req,
  UnauthorizedException,
  UploadedFiles,
  UseInterceptors,
  StreamableFile,
} from '@nestjs/common';
import { FilesInterceptor } from '@nestjs/platform-express';
import { ApelacionSancionService } from '../../SERVICE/apelacion-sancion/apelacion-sancion.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

interface ArchivoSubido {
  originalname: string;
  buffer: Buffer;
}

function validarId(valor: unknown, nombre: string): string {
  if (
    typeof valor !== 'string'
    || !/^[1-9][0-9]{0,18}$/.test(valor)
    || BigInt(valor) > 9223372036854775807n
  ) {
    throw new BadRequestException(`El identificador de ${nombre} no es válido.`);
  }
  return valor;
}

function obtenerActor(solicitud: SolicitudAutenticada): string {
  const actorId = solicitud.user?.usuarioId;

  if (typeof actorId !== 'string') {
    throw new UnauthorizedException('Inicia sesión para continuar.');
  }

  return validarId(actorId, 'usuario');
}

function formatoPermitido(buffer: Buffer): boolean {
  const pdf = buffer.subarray(0, 5).toString('ascii') === '%PDF-';
  const png = buffer.subarray(0, 8).equals(
    Buffer.from([137, 80, 78, 71, 13, 10, 26, 10]),
  );
  const jpeg = buffer[0] === 0xff && buffer[1] === 0xd8 && buffer[2] === 0xff;
  return pdf || png || jpeg;
}

function traducirError(error: unknown): never {
  if (!(error instanceof Error)) throw error;

  const mensaje = error.message;

  if (mensaje.includes('permiso') || mensaje.startsWith('Se requiere') || mensaje.startsWith('Solo puedes')) {
    throw new ForbiddenException(mensaje);
  }
  if (mensaje.startsWith('No se encontró')) {
    throw new NotFoundException(mensaje);
  }
  if (mensaje.includes('Ya existe') || mensaje.includes('ya tiene una decisión')) {
    throw new ConflictException(mensaje);
  }
  if (
    mensaje.includes('debe tener entre')
    || mensaje.includes('Adjunta')
    || mensaje.includes('no es válido')
    || mensaje.includes('no es valida')
  ) {
    throw new BadRequestException(mensaje);
  }

  throw error;
}

@Controller()
export class ApelacionSancionController {
  constructor(private readonly servicio: ApelacionSancionService) {}

  @Get('trabajador/sanciones')
  @Header('Cache-Control', 'no-store')
  async listarSancionesPropias(@Req() solicitud: SolicitudAutenticada) {
    try {
      return await this.servicio.listarSancionesPropias(obtenerActor(solicitud));
    } catch (error) {
      traducirError(error);
    }
  }
  @Post('trabajador/sanciones/:sancionId/apelaciones')
  @UseInterceptors(
    FilesInterceptor('evidencias', 3, {
      limits: { files: 3, fileSize: 5 * 1024 * 1024 },
    }),
  )
  async crear(
    @Req() solicitud: SolicitudAutenticada,
    @Param('sancionId') sancionId: string,
    @Body('justificacion') justificacion: unknown,
    @UploadedFiles() archivos: ArchivoSubido[] = [],
  ) {
    const actorId = obtenerActor(solicitud);
    validarId(sancionId, 'sanción');

    if (archivos.some((archivo) => !formatoPermitido(archivo.buffer))) {
      throw new BadRequestException('Adjunta evidencias PDF, PNG o JPG válidas.');
    }

    try {
      const evidencias = archivos.map((archivo) => ({
        nombreArchivo: archivo.originalname,
        contenido: archivo.buffer,
      }));

      return await this.servicio.crear(
        actorId,
        sancionId,
        justificacion,
        evidencias,
      );
    } catch (error) {
      traducirError(error);
    }
  }

  @Get('trabajador/apelaciones')
  @Header('Cache-Control', 'no-store')
  async listarPropias(@Req() solicitud: SolicitudAutenticada) {
    try {
      return await this.servicio.listarPropias(obtenerActor(solicitud));
    } catch (error) {
      traducirError(error);
    }
  }

  @Get('administracion/apelaciones-sanciones')
  @Header('Cache-Control', 'no-store')
  async listarPendientes(@Req() solicitud: SolicitudAutenticada) {
    try {
      return await this.servicio.listarPendientes(obtenerActor(solicitud));
    } catch (error) {
      traducirError(error);
    }
  }

  @Get('apelaciones-sanciones/:apelacionId')
  @Header('Cache-Control', 'no-store')
  async consultar(
    @Req() solicitud: SolicitudAutenticada,
    @Param('apelacionId') apelacionId: string,
  ) {
    validarId(apelacionId, 'apelación');

    try {
      return await this.servicio.consultar(obtenerActor(solicitud), apelacionId);
    } catch (error) {
      traducirError(error);
    }
  }

  @Post('administracion/apelaciones-sanciones/:apelacionId/decision')
  async resolver(
    @Req() solicitud: SolicitudAutenticada,
    @Param('apelacionId') apelacionId: string,
    @Body() cuerpo: { decision?: unknown; fundamento?: unknown } | undefined,
  ) {
    validarId(apelacionId, 'apelación');

    try {
      return await this.servicio.resolver(
        obtenerActor(solicitud),
        apelacionId,
        cuerpo?.decision,
        cuerpo?.fundamento,
      );
    } catch (error) {
      traducirError(error);
    }
  }
  @Get('apelaciones-sanciones/:apelacionId/evidencias/:evidenciaId')
@Header('Cache-Control', 'no-store')
@Header('X-Content-Type-Options', 'nosniff')
async descargarEvidencia(
  @Req() solicitud: SolicitudAutenticada,
  @Param('apelacionId') apelacionId: string,
  @Param('evidenciaId') evidenciaId: string,
) {
  const actorId = obtenerActor(solicitud);
  validarId(apelacionId, 'apelación');
  validarId(evidenciaId, 'evidencia');

  try {
    const archivo = await this.servicio.descargarEvidencia(
      actorId,
      apelacionId,
      evidenciaId,
    );

    return new StreamableFile(Buffer.from(archivo.contenido), {
      type: 'application/octet-stream',
      disposition: `attachment; filename*=UTF-8''${encodeURIComponent(archivo.nombreArchivo)}`,
    });
  } catch (error) {
    traducirError(error);
  }
}
}