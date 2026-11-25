/**
 * Raiz de NestJS: coordina modulos y controllers, no implementa reglas de negocio.
 */
import { Module } from '@nestjs/common';
import { DatabaseModule } from './INFRASTRUCTURE/database.module';
import { FinalizacionModule } from './API/finalizacion-servicio/finalizacion.module';
import { PagoFinalModule } from './API/pago-final/pago-final.module';
import { casosDeUsoProviders } from './casos-de-uso.providers';

import { CategoriasController } from './API/categorias.controller';
import { ModificacionPrecioController } from './API/modificacion-precio.controller';
import { ComplementoAnticipoController } from './API/complemento-anticipo.controller';
import { CalificacionOpinionController } from './API/calificacion-opinion/calificacion-opinion.controller';
import { ReclamoFormalController } from './API/reclamo-formal/reclamo-formal.controller';
import { DeclaracionAsistenciaController, RevisionAsistenciaController } from './API/declaracion-asistencia/declaracion-asistencia.controller';
import { AvisosCancelacionController, CancelacionClienteController } from './API/cancelacion-cliente/cancelacion-cliente.controller';
import { RevisionDiscrepanciasPagoController } from './API/revision-discrepancias-pago/revision-discrepancias-pago.controller';
import { IncidentesSancionesController } from './API/incidentes-sanciones/incidentes-sanciones.controller';
import { CandidatosAsistenciaController } from './API/casos-escalados/candidatos-asistencia.controller';
import { GestionRevisionAsistenciaController } from './API/casos-escalados/gestion-revision-asistencia.controller';
import { RespuestaOpinionController } from './API/respuesta-opinion/respuesta-opinion.controller';

@Module({
  // DbService se registra una sola vez en DatabaseModule.
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
  ],
  providers: casosDeUsoProviders,
})
export class AppModule {}
