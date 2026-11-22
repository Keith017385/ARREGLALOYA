import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { FinalizacionModule } from './API/finalizacion-servicio/finalizacion.module';
import { CategoriasRepository } from './CORE/categoria';
import { DatabaseModule } from './INFRASTRUCTURE/database.module';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
import { CategoriasService } from './SERVICE/categorias.service';

@Module({
  imports: [DatabaseModule, FinalizacionModule],
  controllers: [CategoriasController],
  providers: [
    CategoriasService,
    {
      provide: CategoriasRepository,
      useClass: PostgresCategoriasRepository,
    },
  ],
})
export class AppModule {}