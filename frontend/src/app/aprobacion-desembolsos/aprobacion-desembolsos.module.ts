import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { AprobacionDesembolsosComponent } from './aprobacion-desembolsos.component';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [AprobacionDesembolsosComponent],
  exports: [AprobacionDesembolsosComponent],
})
export class AprobacionDesembolsosModule {}
