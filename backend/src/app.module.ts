import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { ReclamoFormalController } from './API/reclamo-formal/reclamo-formal.controller';
import { PostgresReclamoFormalRepository } from './INFRASTRUCTURE/reclamo-formal/postgres-reclamo-formal.repository';
import { ReclamoFormalService } from './SERVICE/reclamo-formal/reclamo-formal.service';
import { CategoriasRepository } from './CORE/categoria';
import { CategoriasService } from './SERVICE/categorias.service';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
@Module({
  controllers: [CategoriasController, ReclamoFormalController],
  providers: [DbService, CategoriasService,
    { provide: CategoriasRepository, useClass: PostgresCategoriasRepository },
    {
      provide: ReclamoFormalService,
      useFactory: (db: DbService) =>
        new ReclamoFormalService(new PostgresReclamoFormalRepository(db.pool)),
      inject: [DbService],
    }]
})
export class AppModule {}
