import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ReclamoFormalComponent } from './reclamo-formal.component';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [ReclamoFormalComponent],
  exports: [ReclamoFormalComponent],
})
export class ReclamoFormalModule {}