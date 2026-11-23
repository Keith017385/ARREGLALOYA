import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { EstadoPagoFinal, PagoFinalApiService } from './pago-final-api.service';

@Component({
  selector: 'app-pago-final-reserva',
  template: `
    <p *ngIf="cargando" role="status">Consultando el pago…</p>
    <p *ngIf="error" role="alert">{{ error }}</p>
    <button *ngIf="error && reservaId" type="button" class="btn"
      (click)="cargarEstado()">
      Volver a consultar
    </button>

    <ng-container *ngIf="estado as datos">
      <app-pago-final
        *ngIf="datos.estadoReserva === 'finalizada'"
        [reservaId]="datos.reservaId"
        [rol]="datos.rol"
        [saldoCentavos]="datos.saldoCentavos"
        [pagoRegistrado]="datos.pagoRegistrado"
        [puedeRegistrarPago]="datos.puedeRegistrarPago"
        [plazoRevisionVigente]="datos.plazoRevisionVigente"
        [enRevision]="datos.enRevision"
        [yaSolicitoRevision]="datos.yaSolicitoRevision"
        (pagoActualizado)="cargarEstado()"
        (revisionSolicitada)="cargarEstado()">
      </app-pago-final>
    </ng-container>
  `,
})
export class PagoFinalReservaComponent implements OnChanges, OnDestroy {
  @Input() reservaId = '';

  estado: EstadoPagoFinal | null = null;
  cargando = false;
  error = '';
  private consulta: Subscription | null = null;

  constructor(private readonly api: PagoFinalApiService) {}

  ngOnChanges(): void {
    this.cargarEstado();
  }

  ngOnDestroy(): void {
    if (this.consulta) {
      this.consulta.unsubscribe();
    }
  }

  cargarEstado(): void {
    if (this.consulta) {
      this.consulta.unsubscribe();
    }

    this.estado = null;
    this.error = '';
    this.cargando = Boolean(this.reservaId);

    if (!this.reservaId) {
      return;
    }

    this.consulta = this.api.consultarEstado(this.reservaId).subscribe(
      (estado) => {
        this.estado = estado;
        this.cargando = false;
      },
      (error: HttpErrorResponse) => {
        this.cargando = false;
        if (error.status === 401) {
          this.error = 'Inicia sesión para consultar el pago.';
        } else if (error.status === 403) {
          this.error = 'Solo las partes de la reserva pueden consultar el pago.';
        } else {
          this.error = 'No se pudo consultar el pago de esta reserva.';
        }
      },
    );
  }
}
