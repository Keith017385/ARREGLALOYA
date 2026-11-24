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
import { CancelacionTrabajadorModule } from './cancelacion-trabajador/cancelacion-trabajador.module';
import { RevisionDiscrepanciasPagoModule } from './revision-discrepancias-pago/revision-discrepancias-pago.module';
import { IncidentesSancionesModule } from './incidentes-sanciones/incidentes-sanciones.module';
import { CandidatosAsistenciaModule } from './casos-escalados/candidatos-asistencia.module';
import { RespuestaOpinionModule } from './respuesta-opinion/respuesta-opinion.module';
import { FinalizacionServicioModule } from './finalizacion-servicio/finalizacion-servicio.module';
import { ModificacionPrecioComponent } from './modificacion-precio/modificacion-precio.component';
import { ModificacionPrecioConectadaComponent } from './modificacion-precio/modificacion-precio-conectada.component';

@NgModule({
  declarations: [AppComponent, ModificacionPrecioComponent, ModificacionPrecioConectadaComponent],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    FinalizacionServicioModule,
    PagoFinalModule,
    CalificacionOpinionModule,
    ReclamoFormalModule,
    DeclaracionAsistenciaModule,
    CancelacionClienteModule,
    CancelacionTrabajadorModule,
    RevisionDiscrepanciasPagoModule,
    IncidentesSancionesModule,
    CandidatosAsistenciaModule,
    RespuestaOpinionModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}
