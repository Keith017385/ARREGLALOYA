import {
  Controller,
  ForbiddenException,
  Get,
  Header,
  Req,
  UnauthorizedException,
} from '@nestjs/common';
import { CandidatosAsistenciaService } from '../../SERVICE/casos-escalados/candidatos-asistencia.service';

interface SolicitudAutenticada {
  user?: { usuarioId?: unknown };
}

@Controller('superadministracion/candidatos-escalamiento')
export class CandidatosAsistenciaController {
  constructor(private readonly servicio: CandidatosAsistenciaService) {}

  @Get('asistencia')
  @Header('Cache-Control', 'no-store')
  async listar(@Req() solicitud: SolicitudAutenticada) {
    const actorId = solicitud.user?.usuarioId;
    if (typeof actorId !== 'string'
        || !/^[1-9][0-9]{0,18}$/.test(actorId)
        || BigInt(actorId) > 9223372036854775807n) {
      throw new UnauthorizedException('Inicia sesion para consultar los candidatos a escalamiento.');
    }

    const candidatos = await this.servicio.listarVencidos(actorId);
    if (candidatos === null) {
      throw new ForbiddenException('Se requiere un superadministrador activo.');
    }

    return candidatos;
  }
}
