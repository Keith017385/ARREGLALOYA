import { Module } from '@nestjs/common';
import { CategoriasController } from './API/categorias.controller';
import { PerfilTrabajadorController } from './API/perfil-trabajador.controller';
import { CategoriasRepository } from './CORE/categoria';
import { PerfilTrabajadorRepository } from './CORE/perfil-trabajador';
import { CategoriasService } from './SERVICE/categorias.service';
import { PerfilTrabajadorService } from './SERVICE/perfil-trabajador.service';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
import { PostgresPerfilTrabajadorRepository } from './INFRASTRUCTURE/postgres-perfil-trabajador.repository';

@Module({
  controllers: [CategoriasController, PerfilTrabajadorController],
  providers: [
    DbService,
    CategoriasService,
    PerfilTrabajadorService,
    { provide: CategoriasRepository, useClass: PostgresCategoriasRepository },
    { provide: PerfilTrabajadorRepository, useClass: PostgresPerfilTrabajadorRepository },
  ],
})
export class AppModule {}