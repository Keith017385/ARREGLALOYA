import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { IncidentesSancionesComponent } from './incidentes-sanciones.component';

@NgModule({
  imports: [CommonModule],
  declarations: [IncidentesSancionesComponent],
  exports: [IncidentesSancionesComponent],
})
export class IncidentesSancionesModule {}