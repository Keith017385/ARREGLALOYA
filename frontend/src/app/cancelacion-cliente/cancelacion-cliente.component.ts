import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  CancelacionClienteApiService,
  CancelacionConfirmada,
  VistaPreviaCancelacion,
} from './cancelacion-cliente-api.service';

@Component({
  selector: 'app-cancelacion-cliente',
  template: `
    <section aria-labelledby="cancelacion-titulo">
      <h2 id="cancelacion-titulo">Cancelar reserva</h2>
      <p *ngIf="cargando" role="status">Consultando el importe…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>

      <button *ngIf="error && !vista && !confirmada && !cargando && !guardando"
        class="btn btn-outline" type="button" (click)="cargar()">
        Actualizar vista previa
      </button>

      <ng-container *ngIf="vista as datos">
        <p>Inicio programado: {{ datos.inicioProgramado | date:'dd/MM/yyyy HH:mm':'-0400' }}</p>
        <p>{{ datos.causal === 'cliente_anticipada' ? 'Cancelación anticipada' : 'Cancelación tardía' }}</p>
        <dl>
          <dt>Fondo no desembolsado</dt>
          <dd>{{ datos.fondoCentavos / 100 | currency:'BOB':'Bs ' }}</dd>
          <dt>Reembolso al cliente</dt>
          <dd>{{ datos.reembolsoCentavos / 100 | currency:'BOB':'Bs ' }}</dd>
          <dt>Compensación al trabajador</dt>
          <dd>{{ datos.compensacionTrabajadorCentavos / 100 | currency:'BOB':'Bs ' }}</dd>
          <dt>Parte del fondo para la plataforma</dt>
          <dd>{{ datos.repartoPlataformaCentavos / 100 | currency:'BOB':'Bs ' }}</dd>
          <dt>Comisión que conserva la plataforma</dt>
          <dd>{{ datos.comisionCentavos / 100 | currency:'BOB':'Bs ' }}</dd>
        </dl>

        <form (ngSubmit)="confirmar()">
          <label for="motivo-cancelacion">Motivo de la cancelación</label>
          <textarea id="motivo-cancelacion" name="motivo" rows="3"
            required [(ngModel)]="motivo" [disabled]="guardando"></textarea>
          <button class="btn" type="submit" [disabled]="guardando || !motivo.trim()">
            {{ guardando ? 'Confirmando…' : 'Confirmar cancelación' }}
          </button>
        </form>
      </ng-container>

      <div *ngIf="confirmada as resultado" role="status">
        <p>Reserva cancelada. Registro #{{ resultado.cancelacionId }}.</p>
        <p *ngIf="resultado.solicitudFinancieraId">
          Solicitud financiera #{{ resultado.solicitudFinancieraId }} pendiente de aprobación.
        </p>
      </div>
    </section>
  `,
  styles: [`
    dl { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.5rem 1rem; max-width: 34rem; }
    dd { margin: 0; text-align: right; }
    form { display: grid; gap: 0.75rem; max-width: 34rem; }
    textarea { font: inherit; padding: 0.65rem; resize: vertical; }
    button { justify-self: start; }
  `],
})
export class CancelacionClienteComponent implements OnChanges, OnDestroy {
  @Input() reservaId = '';

  vista: VistaPreviaCancelacion | null = null;
  confirmada: CancelacionConfirmada | null = null;
  motivo = '';
  error = '';
  cargando = false;
  guardando = false;
  private peticiones = new Subscription();

  constructor(private readonly api: CancelacionClienteApiService) {}

  ngOnChanges(): void {
    this.peticiones.unsubscribe();
    this.peticiones = new Subscription();
    this.confirmada = null;
    this.motivo = '';
    this.cargar();
  }

  ngOnDestroy(): void {
    this.peticiones.unsubscribe();
  }

  cargar(): void {
    if (!this.reservaId || this.cargando || this.guardando || this.confirmada) {
      return;
    }

    this.vista = null;
    this.error = '';
    this.cargando = true;
    this.peticiones.add(this.api.consultar(this.reservaId)
      .pipe(finalize(() => { this.cargando = false; }))
      .subscribe(
        (vista) => { this.vista = vista; },
        (error: HttpErrorResponse) => { this.mostrarError(error); },
      ));
  }

  confirmar(): void {
    const vista = this.vista;
    const motivo = this.motivo.trim();
    if (!vista || !motivo || this.guardando) {
      return;
    }

    this.error = '';
    this.guardando = true;
    this.peticiones.add(this.api.confirmar(this.reservaId, motivo, vista)
      .pipe(finalize(() => { this.guardando = false; }))
      .subscribe(
        (resultado) => {
          this.vista = null;
          this.confirmada = resultado;
        },
        (error: HttpErrorResponse) => {
          if (error.status !== 400) {
            this.vista = null;
          }
          this.mostrarError(error);
        },
      ));
  }

  private mostrarError(error: HttpErrorResponse): void {
    if (error.status === 401) {
      this.error = 'Inicia sesión para gestionar la cancelación.';
      return;
    }
    if (error.status === 404) {
      this.error = 'No se encontró la reserva.';
      return;
    }

    const detalle = error.error && error.error.message;
    this.error = (error.status === 400 || error.status === 409) && typeof detalle === 'string'
      ? detalle
      : 'No se pudo completar la operación. Consulta el estado de la reserva antes de intentar de nuevo.';
  }
}