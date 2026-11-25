import { Module } from '@nestjs/common';
import { DbService } from '../../INFRASTRUCTURE/db.service';
import { PostgresEmisionCodigoRepository } from '../../INFRASTRUCTURE/finalizacion-servicio/postgres-emision-codigo.repository';
import { PostgresFinalizacionRepository } from '../../INFRASTRUCTURE/finalizacion-servicio/postgres-finalizacion.repository';
import { EmisionCodigoService } from '../../SERVICE/finalizacion-servicio/emision-codigo.service';
import { FinalizacionService } from '../../SERVICE/finalizacion-servicio/finalizacion.service';
import { FinalizacionController } from './finalizacion.controller';

import { PostgresInicioServicioRepository } from '../../INFRASTRUCTURE/finalizacion-servicio/postgres-inicio-servicio.repository';

@Module({
  controllers: [FinalizacionController],
  providers: [
    PostgresInicioServicioRepository,
    {
      provide: EmisionCodigoService,
      useFactory: (db: DbService) =>
        new EmisionCodigoService(new PostgresEmisionCodigoRepository(db.pool)),
      inject: [DbService],
    },
    {
      provide: FinalizacionService,
      useFactory: (db: DbService) =>
        new FinalizacionService(new PostgresFinalizacionRepository(db.pool)),
      inject: [DbService],
    },
  ],
})
export class FinalizacionModule {}