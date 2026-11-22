import { HttpClientModule } from '@angular/common/http';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { BrowserModule } from '@angular/platform-browser';
import { AppComponent } from './app.component';
import { FinalizacionServicioModule } from './finalizacion-servicio/finalizacion-servicio.module';

@NgModule({
  declarations: [AppComponent],
  imports: [
    BrowserModule,
    FormsModule,
    HttpClientModule,
    FinalizacionServicioModule,
  ],
  bootstrap: [AppComponent],
})
export class AppModule {}