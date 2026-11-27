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
import { UsuariosController } from './API/usuarios.controller';

import { PropietarioTrabajadorGuard } from './API/propietario-trabajador.guard';
import { PerfilTrabajadorController } from './API/perfil-trabajador.controller';
import { DocumentoVerificacionController } from './API/documento-verificacion.controller';
import { SolicitudDisponibleController } from './API/solicitud-disponible.controller';
import { CuentaTrabajadorController } from './API/cuenta-trabajador.controller';
import { CancelacionTrabajadorController } from './API/cancelacion-trabajador/cancelacion-trabajador.controller';
import { DocumentacionTrabajadorController } from './API/documentacion-trabajador/documentacion-trabajador.controller';
import { GestionReclamosController } from './API/gestion-reclamos/gestion-reclamos.controller';
import { AprobacionDesembolsosController } from './API/aprobacion-desembolsos/aprobacion-desembolsos.controller';
import { DictamenAsistenciaController } from './API/dictamen-asistencia.controller';
import { SolicitudesController } from './API/solicitudes.controller';

import { SolicitudDesembolsoController } from './API/solicitud-desembolso.controller';

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
    UsuariosController,
    SolicitudesController,
    SolicitudDesembolsoController,
    PerfilTrabajadorController,
    DocumentoVerificacionController,
    SolicitudDisponibleController,
    CuentaTrabajadorController,
    CancelacionTrabajadorController,
    DocumentacionTrabajadorController,
    GestionReclamosController,
    AprobacionDesembolsosController,
    DictamenAsistenciaController,
  ],
  providers: [...casosDeUsoProviders, PropietarioTrabajadorGuard],
})
export class AppModule {}
