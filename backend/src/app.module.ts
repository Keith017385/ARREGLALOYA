import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { ComplementoAnticipoController } from './API/complemento-anticipo.controller';
import { ModificacionPrecioController } from './API/modificacion-precio.controller';
import { CategoriasRepository } from './CORE/categoria';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
import { PostgresComplementoAnticipoRepository } from './INFRASTRUCTURE/postgres-complemento-anticipo.repository';
import { PostgresInicioComplementoAnticipoRepository } from './INFRASTRUCTURE/postgres-inicio-complemento-anticipo.repository';
import { PostgresModificacionPrecioRepository } from './INFRASTRUCTURE/postgres-modificacion-precio.repository';
import { CategoriasService } from './SERVICE/categorias.service';
import { ModificacionPrecioService } from './SERVICE/modificacion-precio.service';

@Module({
  controllers: [
    CategoriasController,
    ModificacionPrecioController,
    ComplementoAnticipoController,
  ],
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
    {
      provide: PostgresComplementoAnticipoRepository,
      useFactory: (db: DbService) =>
        new PostgresComplementoAnticipoRepository(db.pool),
      inject: [DbService],
    },
    {
      provide: PostgresInicioComplementoAnticipoRepository,
      useFactory: (db: DbService) =>
        new PostgresInicioComplementoAnticipoRepository(db.pool),
      inject: [DbService],
    },
  ],
})
export class AppModule {}