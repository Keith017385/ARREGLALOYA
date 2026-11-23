import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CalificacionOpinionComponent } from './calificacion-opinion.component';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [CalificacionOpinionComponent],
  exports: [CalificacionOpinionComponent],
})
export class CalificacionOpinionModule {}
