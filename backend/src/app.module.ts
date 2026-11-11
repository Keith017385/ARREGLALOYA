import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { CategoriasRepository } from './CORE/categoria';
import { CategoriasService } from './SERVICE/categorias.service';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
@Module({
  controllers: [CategoriasController],
  providers: [DbService, CategoriasService,
    { provide: CategoriasRepository, useClass: PostgresCategoriasRepository }]
})
export class AppModule {}
