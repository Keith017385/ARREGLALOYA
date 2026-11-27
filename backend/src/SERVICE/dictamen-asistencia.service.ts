import { ConflictException, ForbiddenException, Injectable, NotFoundException } from '@nestjs/common';
import {
  CasoAbierto,
  DatosDictamen,
  DictamenAsistenciaRepository,
  ResultadoDictamen,
} from '../CORE/dictamen-asistencia';

@Injectable()
export class DictamenAsistenciaService {
  constructor(private readonly repositorio: DictamenAsistenciaRepository) {}

  listarAbiertos(): Promise<CasoAbierto[]> {
    return this.repositorio.listarAbiertos();
  }

  async dictaminar(datos: DatosDictamen): Promise<ResultadoDictamen> {
    const r = await this.repositorio.dictaminar(datos);
    if (r.codigo === 'sin_permiso') throw new ForbiddenException('Solo un superadministrador puede resolver.');
    if (r.codigo === 'no_encontrado') throw new NotFoundException('Caso no encontrado.');
    if (r.codigo === 'ya_resuelta') throw new ConflictException('Este caso ya fue resuelto.');
    if (r.codigo === 'no_rechazada') throw new ConflictException('Solo una asistencia rechazada puede resolverse.');
    return r;
  }
}