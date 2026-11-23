import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { CalificacionOpinionController } from './API/calificacion-opinion/calificacion-opinion.controller';
import { PostgresCalificacionOpinionRepository } from './INFRASTRUCTURE/calificacion-opinion/postgres-calificacion-opinion.repository';
import { CalificacionOpinionService } from './SERVICE/calificacion-opinion/calificacion-opinion.service';
import { CategoriasRepository } from './CORE/categoria';
import { CategoriasService } from './SERVICE/categorias.service';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
@Module({
  controllers: [CategoriasController, CalificacionOpinionController],
  providers: [DbService, CategoriasService,
    { provide: CategoriasRepository, useClass: PostgresCategoriasRepository },
    {
      provide: CalificacionOpinionService,
      useFactory: (db: DbService) =>
        new CalificacionOpinionService(new PostgresCalificacionOpinionRepository(db.pool)),
      inject: [DbService],
    }]
})
export class AppModule {}
