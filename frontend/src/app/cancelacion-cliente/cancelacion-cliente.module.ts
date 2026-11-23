import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { CancelacionClienteComponent } from './cancelacion-cliente.component';
import { AvisosCancelacionComponent } from './avisos-cancelacion.component';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [CancelacionClienteComponent, AvisosCancelacionComponent],
  exports: [CancelacionClienteComponent, AvisosCancelacionComponent],
})
export class CancelacionClienteModule {}