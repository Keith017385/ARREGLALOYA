import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { FinalizacionServicioModule } from './finalizacion-servicio/finalizacion-servicio.module';
import { ModificacionPrecioComponent } from './modificacion-precio/modificacion-precio.component';

@NgModule({
  declarations: [AppComponent, ModificacionPrecioComponent],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    FinalizacionServicioModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}