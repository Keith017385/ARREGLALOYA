import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { ModificacionPrecioController } from './API/modificacion-precio.controller';
import { CategoriasRepository } from './CORE/categoria';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
import { PostgresModificacionPrecioRepository } from './INFRASTRUCTURE/postgres-modificacion-precio.repository';
import { CategoriasService } from './SERVICE/categorias.service';
import { ModificacionPrecioService } from './SERVICE/modificacion-precio.service';

@Module({
  controllers: [CategoriasController, ModificacionPrecioController],
  providers: [
    DbService,
    CategoriasService,
    {
      provide: CategoriasRepository,
      useClass: PostgresCategoriasRepository,
    },
    {
      provide: PostgresModificacionPrecioRepository,
      useFactory: (db: DbService) =>
        new PostgresModificacionPrecioRepository(db.pool),
      inject: [DbService],
    },
    {
      provide: ModificacionPrecioService,
      useFactory: (repositorio: PostgresModificacionPrecioRepository) =>
        new ModificacionPrecioService(repositorio),
      inject: [PostgresModificacionPrecioRepository],
    },
  ],
})
export class AppModule {}