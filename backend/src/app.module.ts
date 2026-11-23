import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { IncidentesSancionesController } from './API/incidentes-sanciones/incidentes-sanciones.controller';
import { PostgresIncidentesSancionesRepository } from './INFRASTRUCTURE/incidentes-sanciones/postgres-incidentes-sanciones.repository';
import { IncidentesSancionesService } from './SERVICE/incidentes-sanciones/incidentes-sanciones.service';
import { CategoriasRepository } from './CORE/categoria';
import { CategoriasService } from './SERVICE/categorias.service';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
@Module({
  controllers: [CategoriasController, IncidentesSancionesController],
  providers: [DbService, CategoriasService,
    { provide: CategoriasRepository, useClass: PostgresCategoriasRepository },
    {
      provide: IncidentesSancionesService,
      useFactory: (db: DbService) =>
        new IncidentesSancionesService(new PostgresIncidentesSancionesRepository(db.pool)),
      inject: [DbService],
    }]
})
export class AppModule {}
