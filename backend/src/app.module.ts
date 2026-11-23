import { Module } from '@nestjs/common';
import { CalificacionOpinionController } from './API/calificacion-opinion/calificacion-opinion.controller';
import { PostgresCalificacionOpinionRepository } from './INFRASTRUCTURE/calificacion-opinion/postgres-calificacion-opinion.repository';
import { CalificacionOpinionService } from './SERVICE/calificacion-opinion/calificacion-opinion.service';
import { ReclamoFormalController } from './API/reclamo-formal/reclamo-formal.controller';
import { PostgresReclamoFormalRepository } from './INFRASTRUCTURE/reclamo-formal/postgres-reclamo-formal.repository';
import { ReclamoFormalService } from './SERVICE/reclamo-formal/reclamo-formal.service';
import { DeclaracionAsistenciaController, RevisionAsistenciaController } from './API/declaracion-asistencia/declaracion-asistencia.controller';
import { PostgresDeclaracionAsistenciaRepository } from './INFRASTRUCTURE/declaracion-asistencia/postgres-declaracion-asistencia.repository';
import { DeclaracionAsistenciaService } from './SERVICE/declaracion-asistencia/declaracion-asistencia.service';
import { AvisosCancelacionController, CancelacionClienteController } from './API/cancelacion-cliente/cancelacion-cliente.controller';
import { PostgresCancelacionClienteRepository } from './INFRASTRUCTURE/cancelacion-cliente/postgres-cancelacion-cliente.repository';
import { CancelacionClienteService } from './SERVICE/cancelacion-cliente/cancelacion-cliente.service';
import { RevisionDiscrepanciasPagoController } from './API/revision-discrepancias-pago/revision-discrepancias-pago.controller';
import { PostgresRevisionDiscrepanciasPagoRepository } from './INFRASTRUCTURE/revision-discrepancias-pago/postgres-revision-discrepancias-pago.repository';
import { RevisionDiscrepanciasPagoService } from './SERVICE/revision-discrepancias-pago/revision-discrepancias-pago.service';
import { IncidentesSancionesController } from './API/incidentes-sanciones/incidentes-sanciones.controller';
import { PostgresIncidentesSancionesRepository } from './INFRASTRUCTURE/incidentes-sanciones/postgres-incidentes-sanciones.repository';
import { IncidentesSancionesService } from './SERVICE/incidentes-sanciones/incidentes-sanciones.service';
import { CandidatosAsistenciaController, GestionRevisionAsistenciaController } from './API/casos-escalados/gestion-revision-asistencia.controller';
import { PostgresGestionRevisionAsistenciaRepository } from './INFRASTRUCTURE/casos-escalados/postgres-gestion-revision-asistencia.repository';
import { GestionRevisionAsistenciaService } from './SERVICE/casos-escalados/gestion-revision-asistencia.service';
import { RespuestaOpinionController } from './API/respuesta-opinion/respuesta-opinion.controller';
import { PostgresRespuestaOpinionRepository } from './INFRASTRUCTURE/respuesta-opinion/postgres-respuesta-opinion.repository';
import { RespuestaOpinionService } from './SERVICE/respuesta-opinion/respuesta-opinion.service';
import { CandidatosAsistenciaController } from './API/casos-escalados/candidatos-asistencia.controller';
import { PostgresCandidatosAsistenciaRepository } from './INFRASTRUCTURE/casos-escalados/postgres-candidatos-asistencia.repository';
import { PagoFinalModule } from './API/pago-final/pago-final.module';

import { CategoriasController } from './API/categorias.controller';
import { ComplementoAnticipoController } from './API/complemento-anticipo.controller';
import { FinalizacionModule } from './API/finalizacion-servicio/finalizacion.module';
import { ModificacionPrecioController } from './API/modificacion-precio.controller';
import { CategoriasRepository } from './CORE/categoria';
import { DatabaseModule } from './INFRASTRUCTURE/database.module';
import { DbService } from './INFRASTRUCTURE/db.service';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
import { PostgresComplementoAnticipoRepository } from './INFRASTRUCTURE/postgres-complemento-anticipo.repository';
import { PostgresInicioComplementoAnticipoRepository } from './INFRASTRUCTURE/postgres-inicio-complemento-anticipo.repository';
import { PostgresModificacionPrecioRepository } from './INFRASTRUCTURE/postgres-modificacion-precio.repository';
import { CategoriasService } from './SERVICE/categorias.service';
import { ModificacionPrecioService } from './SERVICE/modificacion-precio.service';

@Module({
  imports: [DatabaseModule, FinalizacionModule, PagoFinalModule],
  controllers: [
    CategoriasController,
    ModificacionPrecioController,
    ComplementoAnticipoController,
    CalificacionOpinionController,
    ReclamoFormalController,
    DeclaracionAsistenciaController,
    RevisionAsistenciaController,
    AvisosCancelacionController,
    CancelacionClienteController,
    RevisionDiscrepanciasPagoController,
    IncidentesSancionesController,
    CandidatosAsistenciaController,
    GestionRevisionAsistenciaController,
    RespuestaOpinionController,
    CandidatosAsistenciaController,
  ],
  providers: [
    CategoriasService,
    {
      provide: CalificacionOpinionService,
      useFactory: (db: DbService) => new CalificacionOpinionService(new PostgresCalificacionOpinionRepository(db.pool)),
      inject: [DbService],
    },
    {
      provide: ReclamoFormalService,
      useFactory: (db: DbService) => new ReclamoFormalService(new PostgresReclamoFormalRepository(db.pool)),
      inject: [DbService],
    },
    {
      provide: DeclaracionAsistenciaService,
      useFactory: (db: DbService) => new DeclaracionAsistenciaService(new PostgresDeclaracionAsistenciaRepository(db.pool)),
      inject: [DbService],
    },
    {
      provide: CancelacionClienteService,
      useFactory: (db: DbService) => new CancelacionClienteService(new PostgresCancelacionClienteRepository(db.pool)),
      inject: [DbService],
    },
    {
      provide: RevisionDiscrepanciasPagoService,
      useFactory: (db: DbService) => new RevisionDiscrepanciasPagoService(new PostgresRevisionDiscrepanciasPagoRepository(db.pool)),
      inject: [DbService],
    },
    {
      provide: IncidentesSancionesService,
      useFactory: (db: DbService) => new IncidentesSancionesService(new PostgresIncidentesSancionesRepository(db.pool)),
      inject: [DbService],
    },
    {
      provide: GestionRevisionAsistenciaService,
      useFactory: (db: DbService) => new GestionRevisionAsistenciaService(new PostgresGestionRevisionAsistenciaRepository(db.pool)),
      inject: [DbService],
    },
    {
      provide: RespuestaOpinionService,
      useFactory: (db: DbService) => new RespuestaOpinionService(new PostgresRespuestaOpinionRepository(db.pool)),
      inject: [DbService],
    },
    {
      provide: PostgresCandidatosAsistenciaRepository,
      useFactory: (db: DbService) => new PostgresCandidatosAsistenciaRepository(db.pool),
      inject: [DbService],
    },
    {
      provide: CategoriasRepository,
      useClass: PostgresCategoriasRepository,
    },
    {
      provide: PostgresModificacionPrecioRepository,
      useFactory: (db: DbService) =>
        new PostgresModificacionPrecioRepository(db.pool),
      inject: [DbService],
    },
    {
      provide: ModificacionPrecioService,
      useFactory: (repositorio: PostgresModificacionPrecioRepository) =>
        new ModificacionPrecioService(repositorio),
      inject: [PostgresModificacionPrecioRepository],
    },
    {
      provide: PostgresComplementoAnticipoRepository,
      useFactory: (db: DbService) =>
        new PostgresComplementoAnticipoRepository(db.pool),
      inject: [DbService],
    },
    {
      provide: PostgresInicioComplementoAnticipoRepository,
      useFactory: (db: DbService) =>
        new PostgresInicioComplementoAnticipoRepository(db.pool),
      inject: [DbService],
    },
  ],
})
export class AppModule {}