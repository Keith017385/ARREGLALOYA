import { BadRequestException, Controller, Get, Query } from '@nestjs/common';
import { CategoriasService } from '../SERVICE/categorias.service';
@Controller('categorias')
export class CategoriasController {
  constructor(private readonly categorias: CategoriasService) {}
  @Get() // Atiende GET /api/categorias?q=plomer
  listar(@Query('q') q: unknown = '') {
    if (typeof q !== 'string' || q.trim().length > 80) {
      throw new BadRequestException('La búsqueda debe tener hasta 80 caracteres.');
    }
    return this.categorias.listar(q.trim());
  }
}
