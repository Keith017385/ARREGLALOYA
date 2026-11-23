import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { CandidatosAsistenciaController } from './API/casos-escalados/candidatos-asistencia.controller';
import { GestionRevisionAsistenciaController } from './API/casos-escalados/gestion-revision-asistencia.controller';
import { PostgresGestionRevisionAsistenciaRepository } from './INFRASTRUCTURE/casos-escalados/postgres-gestion-revision-asistencia.repository';
import { GestionRevisionAsistenciaService } from './SERVICE/casos-escalados/gestion-revision-asistencia.service';
import { PostgresCandidatosAsistenciaRepository } from './INFRASTRUCTURE/casos-escalados/postgres-candidatos-asistencia.repository';
import { CategoriasRepository } from './CORE/categoria';
import { CategoriasService } from './SERVICE/categorias.service';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
@Module({
  controllers: [CategoriasController, CandidatosAsistenciaController, GestionRevisionAsistenciaController],
  providers: [DbService, CategoriasService,
    { provide: CategoriasRepository, useClass: PostgresCategoriasRepository },
    {
      provide: GestionRevisionAsistenciaService,
      useFactory: (db: DbService) =>
        new GestionRevisionAsistenciaService(new PostgresGestionRevisionAsistenciaRepository(db.pool)),
      inject: [DbService],
    },
    {
      provide: PostgresCandidatosAsistenciaRepository,
      useFactory: (db: DbService) => new PostgresCandidatosAsistenciaRepository(db.pool),
      inject: [DbService],
    }]
})
export class AppModule {}
