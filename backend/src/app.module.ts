import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import {
  DeclaracionAsistenciaController,
  RevisionAsistenciaController,
} from './API/declaracion-asistencia/declaracion-asistencia.controller';
import { PostgresDeclaracionAsistenciaRepository } from './INFRASTRUCTURE/declaracion-asistencia/postgres-declaracion-asistencia.repository';
import { DeclaracionAsistenciaService } from './SERVICE/declaracion-asistencia/declaracion-asistencia.service';
import { CategoriasRepository } from './CORE/categoria';
import { CategoriasService } from './SERVICE/categorias.service';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
@Module({
  controllers: [CategoriasController, DeclaracionAsistenciaController, RevisionAsistenciaController],
  providers: [DbService, CategoriasService,
    { provide: CategoriasRepository, useClass: PostgresCategoriasRepository },
    {
      provide: DeclaracionAsistenciaService,
      useFactory: (db: DbService) =>
        new DeclaracionAsistenciaService(new PostgresDeclaracionAsistenciaRepository(db.pool)),
      inject: [DbService],
    }]
})
export class AppModule {}
