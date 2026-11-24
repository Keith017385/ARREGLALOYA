import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { GestionReclamosComponent } from './gestion-reclamos.component';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [GestionReclamosComponent],
  exports: [GestionReclamosComponent],
})
export class GestionReclamosModule {}
