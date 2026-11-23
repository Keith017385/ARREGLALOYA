import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

interface CandidatoAsistencia {
  respuestaId: string;
  asistenciaId: string;
  reservaId: string;
  rechazadaEn: string;
  fechaVencimientoBolivia: string;
}

@Component({
  selector: 'app-candidatos-asistencia',
  template: `
    <h1>Candidatos a escalamiento</h1>
    <p>Rechazos de asistencia cuyo plazo de revisión venció.
       Verifica si existe una resolución previa antes de escalar un caso.</p>

    <p *ngIf="cargando" role="status">Consultando candidatos…</p>
    <p *ngIf="error" role="alert">{{ error }}</p>

    <ng-container *ngIf="candidatos as lista">
      <p *ngIf="lista.length === 0">No hay rechazos de asistencia con el plazo vencido.</p>
      <p *ngIf="lista.length === 50">Se muestran los 50 rechazos vencidos más antiguos.</p>

      <div *ngIf="lista.length > 0" class="tabla">
        <table>
          <caption>Rechazos de asistencia con plazo vencido</caption>
          <thead>
            <tr>
              <th scope="col">Reserva</th>
              <th scope="col">Declaración</th>
              <th scope="col">Respuesta</th>
              <th scope="col">Fecha de rechazo</th>
              <th scope="col">Día de vencimiento</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let caso of lista">
              <td>#{{ caso.reservaId }}</td>
              <td>#{{ caso.asistenciaId }}</td>
              <td>#{{ caso.respuestaId }}</td>
              <td>{{ caso.rechazadaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}</td>
              <td>{{ caso.fechaVencimientoBolivia }}</td>
            </tr>
          </tbody>
        </table>
      </div>
    </ng-container>

    <button class="btn btn-outline" type="button" [disabled]="cargando" (click)="cargar()">
      Actualizar reporte
    </button>
  `,
  styles: [`
    .tabla { overflow-x: auto; margin: 1rem 0; }
    table { width: 100%; border-collapse: collapse; }
    caption, th, td { padding: 0.6rem; text-align: left; }
    th, td { border-bottom: 1px solid #ddd; white-space: nowrap; }
  `],
})
export class CandidatosAsistenciaComponent implements OnInit, OnDestroy {
  candidatos: CandidatoAsistencia[] | null = null;
  cargando = false;
  error = '';
  private consulta = Subscription.EMPTY;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.consulta.unsubscribe();
  }

  cargar(): void {
    if (this.cargando) {
      return;
    }

    this.candidatos = null;
    this.error = '';
    this.cargando = true;

    const ruta = '/api/superadministracion/candidatos-escalamiento/asistencia';
    this.consulta = this.http.get<CandidatoAsistencia[]>(ruta)
      .pipe(finalize(() => { this.cargando = false; }))
      .subscribe(
        (candidatos) => { this.candidatos = candidatos; },
        (error: HttpErrorResponse) => {
          if (error.status === 401) {
            this.error = 'Inicia sesión para consultar los candidatos a escalamiento.';
          } else if (error.status === 403) {
            this.error = 'Se requiere una cuenta de superadministrador activa.';
          } else {
            this.error = 'No se pudo consultar el reporte de asistencia.';
          }
        },
      );
  }
}