import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  DeclaracionAsistencia,
  DeclaracionAsistenciaApiService,
  RespuestaAsistencia,
} from './declaracion-asistencia-api.service';

@Component({
  selector: 'app-declaracion-asistencia',
  template: `
    <section aria-labelledby="asistencias-titulo">
      <h2 id="asistencias-titulo">Declaraciones de asistencia</h2>
      <p *ngIf="cargando" role="status">Consultando declaraciones…</p>
      <p *ngIf="mensaje" role="status">{{ mensaje }}</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <button *ngIf="error && !cargando && !guardando" class="btn"
        type="button" (click)="cargar()">Volver a consultar</button>

      <ng-container *ngIf="declaraciones as lista">
        <p *ngIf="lista.length === 0">Aún no hay declaraciones de asistencia.</p>
        <ul *ngIf="lista.length > 0">
          <li *ngFor="let declaracion of lista">
            <p>Declarada el {{ declaracion.declaradaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}</p>
            <p *ngIf="declaracion.respuesta === 'confirmada'">Asistencia confirmada.</p>
            <p *ngIf="declaracion.respuesta === 'rechazada'">
              Asistencia rechazada. El rechazo quedó registrado.
            </p>
            <div *ngIf="!declaracion.respuesta" class="acciones">
              <button type="button" class="btn" [disabled]="guardando"
                (click)="responder(declaracion, 'confirmada')">Confirmar asistencia</button>
              <button type="button" class="btn btn-outline" [disabled]="guardando"
                (click)="responder(declaracion, 'rechazada')">Rechazar asistencia</button>
            </div>
          </li>
        </ul>
      </ng-container>
    </section>
  `,
  styles: [`
    .acciones { display: flex; flex-wrap: wrap; gap: 0.75rem; }
    li { margin-bottom: 1.25rem; }
  `],
})
export class DeclaracionAsistenciaComponent implements OnChanges, OnDestroy {
  @Input() reservaId = '';

  declaraciones: DeclaracionAsistencia[] | null = null;
  cargando = false;
  guardando = false;
  error = '';
  mensaje = '';
  private peticiones = new Subscription();

  constructor(private readonly api: DeclaracionAsistenciaApiService) {}

  ngOnChanges(): void {
    this.mensaje = '';
    this.cargar();
  }

  ngOnDestroy(): void {
    this.peticiones.unsubscribe();
  }

  cargar(): void {
    this.peticiones.unsubscribe();
    this.peticiones = new Subscription();
    this.declaraciones = null;
    this.error = '';
    if (!this.reservaId) {
      return;
    }

    this.cargando = true;
    this.peticiones.add(this.api.consultar(this.reservaId)
      .pipe(finalize(() => { this.cargando = false; }))
      .subscribe(
        (lista) => { this.declaraciones = lista; },
        (error: HttpErrorResponse) => { this.mostrarError(error); },
      ));
  }

  responder(declaracion: DeclaracionAsistencia, respuesta: RespuestaAsistencia): void {
    if (this.guardando || declaracion.respuesta || declaracion.reservaId !== this.reservaId) {
      return;
    }

    this.guardando = true;
    this.error = '';
    this.mensaje = '';

    this.peticiones.add(this.api.responder(this.reservaId, declaracion.id, respuesta)
      .pipe(finalize(() => { this.guardando = false; }))
      .subscribe(
        (guardada) => {
          this.declaraciones = (this.declaraciones || []).map((fila) =>
            fila.id === guardada.asistenciaId ? {
              ...fila,
              respuesta: guardada.respuesta,
              respondidaEn: guardada.respondidaEn,
            } : fila,
          );
          this.mensaje = 'Respuesta guardada.';
        },
        (error: HttpErrorResponse) => { this.mostrarError(error); },
      ));
  }

  private mostrarError(error: HttpErrorResponse): void {
    switch (error.status) {
      case 401:
        this.declaraciones = null;
        this.error = 'Inicia sesión para consultar o responder la asistencia.';
        break;
      case 409:
        this.error = 'La declaración ya fue respondida. Vuelve a consultar para ver el estado.';
        break;
      default:
        this.error = 'No se pudo completar la operación de asistencia.';
    }
  }
}