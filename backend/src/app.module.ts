import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { PagoFinalModule } from './API/pago-final/pago-final.module';
import { CategoriasRepository } from './CORE/categoria';
import { DatabaseModule } from './INFRASTRUCTURE/database.module';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
import { CategoriasService } from './SERVICE/categorias.service';

@Module({
  imports: [DatabaseModule, PagoFinalModule],
  controllers: [CategoriasController],
  providers: [
    CategoriasService,
    { provide: CategoriasRepository, useClass: PostgresCategoriasRepository },
  ],
})
export class AppModule {}
