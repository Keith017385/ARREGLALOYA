import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { RespuestaOpinionController } from './API/respuesta-opinion/respuesta-opinion.controller';
import { PostgresRespuestaOpinionRepository } from './INFRASTRUCTURE/respuesta-opinion/postgres-respuesta-opinion.repository';
import { RespuestaOpinionService } from './SERVICE/respuesta-opinion/respuesta-opinion.service';
import { CategoriasRepository } from './CORE/categoria';
import { CategoriasService } from './SERVICE/categorias.service';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
@Module({
  controllers: [CategoriasController, RespuestaOpinionController],
  providers: [DbService, CategoriasService,
    { provide: CategoriasRepository, useClass: PostgresCategoriasRepository },
    {
      provide: RespuestaOpinionService,
      useFactory: (db: DbService) => new RespuestaOpinionService(new PostgresRespuestaOpinionRepository(db.pool)),
      inject: [DbService],
    }]
})
export class AppModule {}
