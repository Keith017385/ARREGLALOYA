import { Module } from '@nestjs/common';
import { DatabaseModule } from '../../INFRASTRUCTURE/database.module';
import { DbService } from '../../INFRASTRUCTURE/db.service';
import { PostgresPagoFinalRepository } from '../../INFRASTRUCTURE/pago-final/postgres-pago-final.repository';
import { PagoFinalService } from '../../SERVICE/pago-final/pago-final.service';
import { PagoFinalController } from './pago-final.controller';

@Module({
  imports: [DatabaseModule],
  controllers: [PagoFinalController],
  providers: [
    {
      provide: PagoFinalService,
      useFactory: (db: DbService) =>
        new PagoFinalService(new PostgresPagoFinalRepository(db.pool)),
      inject: [DbService],
    },
  ],
})
export class PagoFinalModule {}
