import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { PagoFinalComponent } from './pago-final.component';
import { PagoFinalReservaComponent } from './pago-final-reserva.component';

@NgModule({
  imports: [CommonModule],
  declarations: [PagoFinalComponent, PagoFinalReservaComponent],
  exports: [PagoFinalComponent, PagoFinalReservaComponent],
})
export class PagoFinalModule {}
