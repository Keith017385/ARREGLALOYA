import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import {
  AvisosCancelacionController,
  CancelacionClienteController,
} from './API/cancelacion-cliente/cancelacion-cliente.controller';
import { PostgresCancelacionClienteRepository } from './INFRASTRUCTURE/cancelacion-cliente/postgres-cancelacion-cliente.repository';
import { CancelacionClienteService } from './SERVICE/cancelacion-cliente/cancelacion-cliente.service';
import { CategoriasRepository } from './CORE/categoria';
import { CategoriasService } from './SERVICE/categorias.service';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
@Module({
  controllers: [CategoriasController, CancelacionClienteController, AvisosCancelacionController],
  providers: [DbService, CategoriasService,
    { provide: CategoriasRepository, useClass: PostgresCategoriasRepository },
    {
      provide: CancelacionClienteService,
      useFactory: (db: DbService) =>
        new CancelacionClienteService(new PostgresCancelacionClienteRepository(db.pool)),
      inject: [DbService],
    }]
})
export class AppModule {}
