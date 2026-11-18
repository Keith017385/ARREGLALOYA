import { Module } from '@nestjs/common';
import { CatalogoService } from './catalogo.service.js';

@Module({
  providers: [CatalogoService]
})
export class CatalogoModule {}
