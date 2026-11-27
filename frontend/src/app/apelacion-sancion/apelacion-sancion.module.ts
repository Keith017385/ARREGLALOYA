import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { FormsModule } from '@angular/forms';
import { MisApelacionesComponent } from './mis-apelaciones.component';
import { RevisionApelacionesComponent } from './revision-apelaciones.component';

@NgModule({
  imports: [CommonModule, FormsModule],
  declarations: [MisApelacionesComponent, RevisionApelacionesComponent],
  exports: [MisApelacionesComponent, RevisionApelacionesComponent],
})
export class ApelacionSancionModule {}