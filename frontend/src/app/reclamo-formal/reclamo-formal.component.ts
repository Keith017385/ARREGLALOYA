import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ReclamoFormalApiService, ReclamoRegistrado } from './reclamo-formal-api.service';

@Component({
  selector: 'app-reclamo-formal',
  template: `
    <section *ngIf="reservaId" aria-labelledby="reclamos-titulo">
      <h2 id="reclamos-titulo">Reclamos de la reserva</h2>
      <p *ngIf="cargando" role="status">Consultando reclamos…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="mensaje" role="status">{{ mensaje }}</p>

      <ng-container *ngIf="reclamos as lista">
        <p *ngIf="lista.length === 0">Todavía no hay reclamos para esta reserva.</p>
        <ul *ngIf="lista.length > 0">
          <li *ngFor="let reclamo of lista">
            <strong>Reclamo #{{ reclamo.id }} · {{ etiquetas[reclamo.estado] }}</strong>
            <p>{{ reclamo.descripcion }}</p>
            <time [attr.datetime]="reclamo.presentadoEn">
              {{ reclamo.presentadoEn | date:'dd/MM/yyyy HH:mm':'-0400' }}
            </time>
          </li>
        </ul>

        <form (ngSubmit)="presentar()">
          <h3>Presentar un reclamo formal</h3>
          <p>El plazo ordinario es de seis días después de la finalización del servicio.</p>
          <label for="descripcion-reclamo">Describe el problema con el servicio</label>
          <textarea id="descripcion-reclamo" name="descripcion" rows="4" required
            [(ngModel)]="descripcion" [disabled]="guardando"></textarea>
          <button class="btn" type="submit" [disabled]="guardando || !descripcion.trim()">
            {{ guardando ? 'Enviando…' : 'Presentar reclamo' }}
          </button>
        </form>
      </ng-container>
    </section>
  `,
  styles: [`
    form { display: grid; gap: 0.75rem; max-width: 36rem; }
    textarea { font: inherit; padding: 0.65rem; resize: vertical; }
    button { justify-self: start; }
    li { margin-bottom: 1rem; overflow-wrap: anywhere; }
  `],
})
export class ReclamoFormalComponent implements OnChanges, OnDestroy {
  @Input() reservaId = '';

  readonly etiquetas = {
    abierto: 'Abierto',
    en_revision: 'En revisión',
    resuelto: 'Resuelto',
  };

  reclamos: ReclamoRegistrado[] | null = null;
  descripcion = '';
  mensaje = '';
  error = '';
  cargando = false;
  guardando = false;
  private operaciones = new Subscription();

  constructor(private readonly api: ReclamoFormalApiService) {}

  ngOnChanges(): void {
    this.operaciones.unsubscribe();
    this.operaciones = new Subscription();
    this.reclamos = null;
    this.descripcion = '';
    this.mensaje = '';
    this.error = '';
    this.cargando = Boolean(this.reservaId);

    if (!this.reservaId) {
      return;
    }

    this.operaciones.add(
      this.api.consultar(this.reservaId)
        .pipe(finalize(() => { this.cargando = false; }))
        .subscribe(
          (reclamos) => { this.reclamos = reclamos; },
          (error: HttpErrorResponse) => { this.mostrarError(error); },
        ),
    );
  }

  ngOnDestroy(): void {
    this.operaciones.unsubscribe();
  }

  presentar(): void {
    const descripcion = this.descripcion.trim();
    const reclamos = this.reclamos;

    if (!this.reservaId || reclamos === null || this.guardando || !descripcion) {
      return;
    }

    this.error = '';
    this.mensaje = '';
    this.guardando = true;

    this.operaciones.add(
      this.api.presentar(this.reservaId, descripcion)
        .pipe(finalize(() => { this.guardando = false; }))
        .subscribe(
          (reclamo) => {
            this.reclamos = [reclamo, ...reclamos];
            this.descripcion = '';
            this.mensaje = `Reclamo ${reclamo.id} presentado correctamente.`;
          },
          (error: HttpErrorResponse) => { this.mostrarError(error); },
        ),
    );
  }

  private mostrarError(error: HttpErrorResponse): void {
    if (error.status === 401) {
      this.reclamos = null;
      this.error = 'Inicia sesión para gestionar tus reclamos.';
      return;
    }

    const detalle = error.error && error.error.message;
    this.error = [400, 403, 409].indexOf(error.status) >= 0 && typeof detalle === 'string'
      ? detalle
      : 'No se pudo completar la operación de reclamos.';
  }
}