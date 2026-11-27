import { Injectable } from '@nestjs/common';
import { CatalogoTrabajadoresRepository } from '../CORE/catalogo-trabajadores';

@Injectable()
export class CatalogoTrabajadoresService {
  constructor(private readonly repositorio: CatalogoTrabajadoresRepository) {}

  listar(categoriaId: string) {
    return this.repositorio.listar(categoriaId);
  }
}