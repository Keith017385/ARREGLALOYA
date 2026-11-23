import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { RevisionDiscrepanciasPagoController } from './API/revision-discrepancias-pago/revision-discrepancias-pago.controller';
import { PostgresRevisionDiscrepanciasPagoRepository } from './INFRASTRUCTURE/revision-discrepancias-pago/postgres-revision-discrepancias-pago.repository';
import { RevisionDiscrepanciasPagoService } from './SERVICE/revision-discrepancias-pago/revision-discrepancias-pago.service';
import { CategoriasRepository } from './CORE/categoria';
import { CategoriasService } from './SERVICE/categorias.service';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
@Module({
  controllers: [CategoriasController, RevisionDiscrepanciasPagoController],
  providers: [DbService, CategoriasService,
    { provide: CategoriasRepository, useClass: PostgresCategoriasRepository },
    {
      provide: RevisionDiscrepanciasPagoService,
      useFactory: (db: DbService) =>
        new RevisionDiscrepanciasPagoService(new PostgresRevisionDiscrepanciasPagoRepository(db.pool)),
      inject: [DbService],
    }]
})
export class AppModule {}
