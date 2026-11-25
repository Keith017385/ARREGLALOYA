import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { PagoFinalModule } from './pago-final/pago-final.module';
import { CalificacionOpinionModule } from './calificacion-opinion/calificacion-opinion.module';
import { ReclamoFormalModule } from './reclamo-formal/reclamo-formal.module';
import { DeclaracionAsistenciaModule } from './declaracion-asistencia/declaracion-asistencia.module';
import { CancelacionClienteModule } from './cancelacion-cliente/cancelacion-cliente.module';
import { RevisionDiscrepanciasPagoModule } from './revision-discrepancias-pago/revision-discrepancias-pago.module';
import { IncidentesSancionesModule } from './incidentes-sanciones/incidentes-sanciones.module';
import { CandidatosAsistenciaModule } from './casos-escalados/candidatos-asistencia.module';
import { RespuestaOpinionModule } from './respuesta-opinion/respuesta-opinion.module';
import { FinalizacionServicioModule } from './finalizacion-servicio/finalizacion-servicio.module';
import { ModificacionPrecioConectadaComponent } from './modificacion-precio/modificacion-precio-conectada.component';

import { PerfilTrabajadorComponent } from './trabajadores/perfil-trabajador.component';
import { DocumentosTrabajadorComponent } from './trabajadores/documentos-trabajador.component';
import { SolicitudesTrabajadorComponent } from './trabajadores/solicitudes-trabajador.component';
import { CuentaTrabajadorComponent } from './trabajadores/cuenta-trabajador.component';
import { CancelacionTrabajadorModule } from './cancelacion-trabajador/cancelacion-trabajador.module';
import { DocumentacionTrabajadorModule } from './documentacion-trabajador/documentacion-trabajador.module';
import { GestionReclamosModule } from './gestion-reclamos/gestion-reclamos.module';
import { AprobacionDesembolsosModule } from './aprobacion-desembolsos/aprobacion-desembolsos.module';

import { SolicitudesComponent } from './solicitudes/solicitudes.component';

import { DesembolsoTrabajadorComponent } from './trabajadores/desembolso-trabajador.component';

@NgModule({
  declarations: [AppComponent, DesembolsoTrabajadorComponent, SolicitudesComponent, ModificacionPrecioConectadaComponent, PerfilTrabajadorComponent, DocumentosTrabajadorComponent, SolicitudesTrabajadorComponent, CuentaTrabajadorComponent],
  imports: [
    BrowserModule,
    FormsModule,
    CancelacionTrabajadorModule,
    DocumentacionTrabajadorModule,
    GestionReclamosModule,
    AprobacionDesembolsosModule,
    HttpClientModule,
    FinalizacionServicioModule,
    PagoFinalModule,
    CalificacionOpinionModule,
    ReclamoFormalModule,
    DeclaracionAsistenciaModule,
    CancelacionClienteModule,
    RevisionDiscrepanciasPagoModule,
    IncidentesSancionesModule,
    CandidatosAsistenciaModule,
    RespuestaOpinionModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}