import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

interface AvisoCancelacion {
  cancelacionId: string;
  reservaId: string;
  canceladaEn: string;
}

@Component({
  selector: 'app-avisos-cancelacion',
  template: `
    <section aria-labelledby="avisos-cancelacion-titulo">
      <h1 id="avisos-cancelacion-titulo">Avisos de cancelación</h1>
      <p *ngIf="cargando" role="status">Consultando avisos…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>

      <ng-container *ngIf="avisos as lista">
        <p *ngIf="lista.length === 0">No tienes avisos de cancelación.</p>
        <ul *ngIf="lista.length > 0">
          <li *ngFor="let aviso of lista">
            El cliente canceló la reserva #{{ aviso.reservaId }}.
            <time [attr.datetime]="aviso.canceladaEn">
              {{ aviso.canceladaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}
            </time>
          </li>
        </ul>
      </ng-container>

      <button class="btn btn-outline" type="button"
        [disabled]="cargando" (click)="cargar()">Actualizar avisos</button>
    </section>
  `,
})
export class AvisosCancelacionComponent implements OnInit, OnDestroy {
  avisos: AvisoCancelacion[] | null = null;
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

    this.avisos = null;
    this.error = '';
    this.cargando = true;
    this.consulta = this.http.get<AvisoCancelacion[]>('/api/trabajador/avisos/cancelaciones')
      .pipe(finalize(() => { this.cargando = false; }))
      .subscribe(
        (avisos) => { this.avisos = avisos; },
        (error: HttpErrorResponse) => {
          this.error = error.status === 401
            ? 'Inicia sesión para consultar tus avisos.'
            : 'No se pudieron consultar los avisos de cancelación.';
        },
      );
  }
}