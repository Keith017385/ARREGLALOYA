import { CommonModule } from '@angular/common';
import { NgModule } from '@angular/core';
import { CandidatosAsistenciaComponent } from './candidatos-asistencia.component';
import { GestionRevisionAsistenciaComponent } from './gestion-revision-asistencia.component';

@NgModule({
  imports: [CommonModule],
  declarations: [CandidatosAsistenciaComponent, GestionRevisionAsistenciaComponent],
  exports: [CandidatosAsistenciaComponent, GestionRevisionAsistenciaComponent],
})
export class CandidatosAsistenciaModule {}