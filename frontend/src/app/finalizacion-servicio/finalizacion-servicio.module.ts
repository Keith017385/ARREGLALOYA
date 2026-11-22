import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { FinalizacionServicioComponent } from './finalizacion-servicio.component';

@NgModule({
  declarations: [FinalizacionServicioComponent],
  imports: [CommonModule, FormsModule],
  exports: [FinalizacionServicioComponent],
})
export class FinalizacionServicioModule {}