import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';
import { IncidentesSancionesModule } from './incidentes-sanciones/incidentes-sanciones.module';
@NgModule({ declarations: [AppComponent], imports: [BrowserModule, FormsModule, HttpClientModule, IncidentesSancionesModule],
  bootstrap: [AppComponent] })
export class AppModule {}
