import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CancelacionTrabajadorComponent } from './cancelacion-trabajador.component';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [CancelacionTrabajadorComponent],
  exports: [CancelacionTrabajadorComponent],
})
export class CancelacionTrabajadorModule {}
