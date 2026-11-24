import { HttpErrorResponse } from '@angular/common/http';
import { Component, EventEmitter, Input, OnChanges, Output } from '@angular/core';
import { Observable } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { PagoDirecto, PagoFinalApiService } from './pago-final-api.service';

@Component({
  selector: 'app-pago-final',
  template: `
    <section *ngIf="reservaId" aria-labelledby="pago-final-titulo">
      <h2 id="pago-final-titulo">Pago final del servicio</h2>

      <ng-container *ngIf="pagoActual as pago; else sinPago">
        <p>Importe declarado: {{ pago.importeCentavos / 100 | currency:'BOB':'Bs ' }}</p>
        <p *ngIf="pago.confirmadoEn">Recepción confirmada.</p>
        <p *ngIf="!pago.confirmadoEn">Pendiente de confirmación del trabajador.</p>
        <button class="btn" type="button"
          *ngIf="rol === 'trabajador' && !pago.confirmadoEn && !enRevision && revisionEnviadaPara !== pago.id"
          [disabled]="ocupado" (click)="confirmar()">
          Confirmar que recibí el pago
        </button>
      </ng-container>

      <ng-container *ngIf="pagoActual as pago">
        <p *ngIf="!pago.confirmadoEn && (enRevision || revisionEnviadaPara === pago.id)"
          role="status">
          Pago pendiente de revisión administrativa.
        </p>

        <p *ngIf="!pago.confirmadoEn && rol && !plazoRevisionVigente && !yaSolicitoRevision">
          El plazo para solicitar revisión ha vencido.
        </p>

        <form *ngIf="!pago.confirmadoEn && rol && plazoRevisionVigente && !yaSolicitoRevision && revisionEnviadaPara !== pago.id"
          (submit)="$event.preventDefault(); solicitarRevision(declaracion.value, importe.value)">
          <h3>Solicitar revisión del pago</h3>
          <p>Puedes presentar tu declaración hasta tres días hábiles después de la finalización.</p>

          <label>
            Explica la diferencia en el pago
            <textarea #declaracion required maxlength="2000" rows="4"
              [disabled]="ocupado"></textarea>
          </label>

          <label>
            Importe que reportas en Bs (opcional)
            <input #importe type="text" inputmode="decimal" placeholder="0,00"
              [disabled]="ocupado">
          </label>

          <button class="btn" type="submit" [disabled]="ocupado">Solicitar revisión</button>
        </form>
      </ng-container>

      <ng-template #sinPago>
        <ng-container *ngIf="rol === 'cliente' && saldoCentavos > 0 && puedeRegistrarPago">
          <p>Saldo pendiente: {{ saldoCentavos / 100 | currency:'BOB':'Bs ' }}</p>
          <p>Después de pagar directamente al trabajador, registra el pago aquí.</p>
          <button class="btn" type="button" [disabled]="ocupado" (click)="declarar()">
            Registrar pago realizado
          </button>
        </ng-container>
        <p *ngIf="rol === 'cliente' && saldoCentavos > 0 && !puedeRegistrarPago">
          El pago todavía no está disponible para registro.
        </p>
        <p *ngIf="rol === 'trabajador'">El cliente todavía no ha declarado el pago.</p>
        <p *ngIf="rol === 'cliente' && saldoCentavos === 0">No hay saldo pendiente.</p>
        <p *ngIf="rol === 'cliente' && saldoCentavos < 0">El saldo requiere revisión.</p>
      </ng-template>

      <p *ngIf="ocupado" role="status">Guardando…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
    </section>
  `,
})
export class PagoFinalComponent implements OnChanges {
  @Input() reservaId = '';
  @Input() rol: 'cliente' | 'trabajador' | null = null;
  @Input() saldoCentavos = 0;
  @Input() pagoRegistrado: PagoDirecto | null = null;
  @Input() puedeRegistrarPago = false;
  @Input() plazoRevisionVigente = false;
  @Input() enRevision = false;
  @Input() yaSolicitoRevision = false;
  @Output() pagoActualizado = new EventEmitter<PagoDirecto>();
  @Output() revisionSolicitada = new EventEmitter<string>();

  revisionEnviadaPara: string | null = null;

  pagoActual: PagoDirecto | null = null;
  ocupado = false;
  error = '';

  constructor(private readonly api: PagoFinalApiService) {}

  ngOnChanges(): void {
    this.pagoActual = this.pagoRegistrado;
    this.error = '';
  }

  declarar(): void {
    if (this.ocupado || this.rol !== 'cliente' || !this.reservaId
        || this.pagoActual || this.saldoCentavos <= 0 || !this.puedeRegistrarPago) {
      return;
    }
    this.guardar(this.api.declarar(this.reservaId, this.saldoCentavos));
  }

  confirmar(): void {
    const pago = this.pagoActual;
    if (this.ocupado || this.rol !== 'trabajador' || !pago
        || pago.confirmadoEn || pago.reservaId !== this.reservaId
        || this.enRevision || this.revisionEnviadaPara === pago.id) {
      return;
    }
    this.guardar(this.api.confirmar(this.reservaId, pago.id));
  }

  solicitarRevision(declaracion: string, importeEnBs: string): void {
    const pago = this.pagoActual;
    const reservaId = this.reservaId;

    if (this.ocupado || !this.rol || !pago || pago.confirmadoEn
        || pago.reservaId !== reservaId || !this.plazoRevisionVigente || this.yaSolicitoRevision
        || this.revisionEnviadaPara === pago.id) {
      return;
    }

    const texto = declaracion.trim();
    if (!texto) {
      this.error = 'Escribe una declaración para solicitar revisión.';
      return;
    }

    const importe = importeEnBs.trim();
    let importeCentavos: number | null = null;

    if (importe !== '') {
      if (!/^\d+(?:[,.]\d{1,2})?$/.test(importe)) {
        this.error = 'Introduce un importe válido, con hasta dos decimales.';
        return;
      }

      const [bolivianos, decimales = ''] = importe.split(/[,.]/);
      importeCentavos = Number(bolivianos + decimales.padEnd(2, '0'));

      if (!Number.isSafeInteger(importeCentavos)) {
        this.error = 'El importe supera el máximo admitido.';
        return;
      }
    }

    this.ocupado = true;
    this.error = '';

    this.api.solicitarRevision(reservaId, pago.id, texto, importeCentavos)
      .pipe(finalize(() => { this.ocupado = false; }))
      .subscribe(
        (revision) => {
          if (this.reservaId === reservaId && this.pagoActual && this.pagoActual.id === pago.id) {
            this.revisionEnviadaPara = pago.id;
            this.revisionSolicitada.emit(revision.id);
          }
        },
        (error: HttpErrorResponse) => {
          if (this.reservaId !== reservaId) {
            return;
          }
          if (error.status === 401) {
            this.error = 'Inicia sesión para continuar.';
            return;
          }
          const mensaje = error.error && error.error.message;
          this.error = error.status >= 400 && error.status < 500 && typeof mensaje === 'string'
            ? mensaje
            : 'No se pudo solicitar la revisión. Intenta de nuevo.';
        },
      );
  }

  private guardar(peticion: Observable<PagoDirecto>): void {
    const reservaId = this.reservaId;
    this.ocupado = true;
    this.error = '';

    peticion.pipe(finalize(() => { this.ocupado = false; })).subscribe(
      (pago) => {
        if (this.reservaId === reservaId) {
          this.pagoActual = pago;
          this.pagoActualizado.emit(pago);
        }
      },
      (error: HttpErrorResponse) => {
        if (this.reservaId !== reservaId) {
          return;
        }
        if (error.status === 401) {
          this.error = 'Inicia sesión para continuar.';
          return;
        }
        const mensaje = error.error && error.error.message;
        this.error = error.status >= 400 && error.status < 500
          && typeof mensaje === 'string'
          ? mensaje
          : 'No se pudo guardar el pago. Intenta de nuevo.';
      },
    );
  }
}
