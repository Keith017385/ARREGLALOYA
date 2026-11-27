import { BadRequestException, Controller, Get, Header, Query } from '@nestjs/common';
import { CatalogoTrabajadoresService } from '../SERVICE/catalogo-trabajadores.service';

function validarCategoriaId(valor: unknown): string {
  if (
    typeof valor !== 'string'
    || !/^[1-9][0-9]{0,18}$/.test(valor)
    || BigInt(valor) > 9223372036854775807n
  ) {
    throw new BadRequestException('Selecciona una categoría válida.');
  }
  return valor;
}

@Controller('catalogo')
export class CatalogoTrabajadoresController {
  constructor(private readonly servicio: CatalogoTrabajadoresService) {}

  @Get('trabajadores')
  @Header('Cache-Control', 'no-store')
  listar(@Query('categoriaId') categoriaId: unknown) {
    return this.servicio.listar(validarCategoriaId(categoriaId));
  }
}