import { BrowserModule } from '@angular/platform-browser';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { HttpClientModule } from '@angular/common/http';
import { AppComponent } from './app.component';
import { CalificacionOpinionModule } from './calificacion-opinion/calificacion-opinion.module';
@NgModule({ declarations: [AppComponent], imports: [BrowserModule, FormsModule, HttpClientModule, CalificacionOpinionModule],
  bootstrap: [AppComponent] })
export class AppModule {}
