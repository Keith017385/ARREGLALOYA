import { Injectable } from '@nestjs/common';
import { CategoriasRepository } from '../CORE/categoria';
@Injectable()
export class CategoriasService {
  constructor(private readonly repositorio: CategoriasRepository) {}
  listar(busqueda: string) {
    return this.repositorio.listar(busqueda);
  }
}
