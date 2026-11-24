import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  CancelacionTrabajadorApiService,
  CancelacionTrabajadorConfirmada,
  VistaPreviaCancelacionTrabajador,
} from './cancelacion-trabajador-api.service';

@Component({
  selector: 'app-cancelacion-trabajador',
  template: `
    <section class="cu15" aria-labelledby="cu15-titulo">
      <h2 id="cu15-titulo">CU-15 · Cancelar servicio reservado</h2>
      <p class="cu15-intro">
        Esta operación registra una cancelación atribuible al trabajador, solicita el reembolso
        que corresponda y deja constancia del incidente para revisión administrativa.
      </p>

      <p *ngIf="cargando" role="status">Consultando la reserva y sus importes…</p>
      <p class="cu15-error" *ngIf="error" role="alert">{{ error }}</p>

      <button *ngIf="error && !vista && !confirmada && !cargando && !guardando"
        class="btn btn-outline" type="button" (click)="cargar()">
        Volver a consultar
      </button>

      <ng-container *ngIf="vista as datos">
        <div class="cu15-resumen">
          <p><strong>Reserva:</strong> #{{ datos.reservaId }}</p>
          <p><strong>Estado actual:</strong> {{ datos.estado }}</p>
          <p><strong>Inicio programado:</strong>
            {{ datos.inicioProgramado | date:'dd/MM/yyyy HH:mm':'-0400' }}
          </p>
        </div>

        <h3>Tratamiento financiero estimado</h3>
        <dl>
          <dt>Reembolso al cliente (100 % recibido)</dt>
          <dd>{{ datos.reembolsoCentavos / 100 | currency:'BOB':'Bs ' }}</dd>
          <dt>Desembolsos previos que se registrarán como deuda</dt>
          <dd>{{ datos.desembolsosPreviosCentavos / 100 | currency:'BOB':'Bs ' }}</dd>
        </dl>

        <p class="cu15-aviso">
          El importe mostrado es una vista previa. Al confirmar, el sistema registrará la
          solicitud de reembolso; no realizará una transferencia automática. La aprobación y
          ejecución financiera corresponden al procedimiento administrativo.
        </p>

        <form (ngSubmit)="confirmar()">
          <label for="cu15-motivo">Motivo de la cancelación</label>
          <textarea id="cu15-motivo" name="motivo" rows="4" required
            [(ngModel)]="motivo" [disabled]="guardando"
            placeholder="Describe por qué no podrás realizar el servicio."></textarea>
          <button class="btn" type="submit"
            [disabled]="guardando || !motivo.trim()">
            {{ guardando ? 'Registrando cancelación…' : 'Confirmar cancelación' }}
          </button>
        </form>
      </ng-container>

      <div class="cu15-confirmacion" *ngIf="confirmada as resultado" role="status">
        <h3>Cancelación registrada</h3>
        <p>La reserva #{{ resultado.reservaId }} cambió de
          <strong>{{ resultado.estadoAnterior }}</strong> a <strong>cancelada</strong>.</p>
        <p>Registro de cancelación: #{{ resultado.cancelacionId }}.</p>
        <p>Incidente para revisión administrativa: #{{ resultado.incidenteId }}.</p>
        <p *ngIf="resultado.solicitudFinancieraId">
          Solicitud de reembolso: #{{ resultado.solicitudFinancieraId }}. Pendiente de revisión
          y ejecución por el procedimiento financiero.
        </p>
        <p *ngIf="!resultado.solicitudFinancieraId">
          No se creó solicitud de reembolso porque no existen anticipos confirmados que devolver.
        </p>
        <p><strong>Importe a devolver:</strong>
          {{ resultado.reembolsoCentavos / 100 | currency:'BOB':'Bs ' }}
        </p>
        <p><strong>Desembolsos registrados como deuda:</strong>
          {{ resultado.desembolsosPreviosCentavos / 100 | currency:'BOB':'Bs ' }}
        </p>
      </div>
    </section>
  `,
  styles: [`
    .cu15 { max-width: 48rem; padding: 1rem 0; }
    .cu15-intro { max-width: 42rem; color: #555; }
    .cu15-resumen, .cu15-aviso, .cu15-confirmacion { margin: 1rem 0; padding: 1rem; background: #f6f5fb; border-radius: 0.5rem; }
    .cu15-resumen p { margin: 0.35rem 0; }
    .cu15-error { color: #a12626; }
    dl { display: grid; grid-template-columns: minmax(0, 1fr) auto; gap: 0.6rem 1rem; max-width: 42rem; }
    dd { margin: 0; text-align: right; font-weight: 600; }
    form { display: grid; gap: 0.75rem; max-width: 42rem; }
    textarea { box-sizing: border-box; width: 100%; padding: 0.7rem; font: inherit; resize: vertical; }
    form button { justify-self: start; }
    @media (max-width: 600px) { dl { grid-template-columns: 1fr; } dd { text-align: left; margin-bottom: 0.35rem; } }
  `],
})
export class CancelacionTrabajadorComponent implements OnChanges, OnDestroy {
  @Input() reservaId = '';

  vista: VistaPreviaCancelacionTrabajador | null = null;
  confirmada: CancelacionTrabajadorConfirmada | null = null;
  motivo = '';
  error = '';
  cargando = false;
  guardando = false;
  private peticiones = new Subscription();

  constructor(private readonly api: CancelacionTrabajadorApiService) {}

  ngOnChanges(): void {
    this.peticiones.unsubscribe();
    this.peticiones = new Subscription();
    this.vista = null;
    this.confirmada = null;
    this.motivo = '';
    this.error = '';
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
          // Un conflicto invalida la vista previa; el usuario debe volver a consultar.
          if (error.status === 409) {
            this.vista = null;
          }
          this.mostrarError(error);
        },
      ));
  }

  private mostrarError(error: HttpErrorResponse): void {
    if (error.status === 401) {
      this.error = 'Inicia sesión para gestionar la cancelación. La autenticación del proyecto aún está pendiente.';
      return;
    }
    if (error.status === 403) {
      this.error = 'La cuenta no tiene un rol de trabajador activo o no corresponde al trabajador contratado en esta reserva.';
      return;
    }
    if (error.status === 404) {
      this.error = 'No se encontró la reserva.';
      return;
    }

    const detalle = error.error && error.error.message;
    this.error = (error.status === 400 || error.status === 409) && typeof detalle === 'string'
      ? detalle
      : 'No se pudo completar la operación. Consulta el estado de la reserva antes de volver a intentar.';
  }
}
