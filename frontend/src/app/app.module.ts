import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';
import { PerfilTrabajadorComponent } from './trabajadores/perfil-trabajador.component';
@NgModule({ declarations: [AppComponent, PerfilTrabajadorComponent], imports: [BrowserModule, FormsModule, HttpClientModule],
  bootstrap: [AppComponent] })
export class AppModule {}
