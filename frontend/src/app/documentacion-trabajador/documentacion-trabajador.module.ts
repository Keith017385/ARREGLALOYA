import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { DocumentacionTrabajadorComponent } from './documentacion-trabajador.component';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [DocumentacionTrabajadorComponent],
  exports: [DocumentacionTrabajadorComponent],
})
export class DocumentacionTrabajadorModule {}
