import { HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  CalificacionOpinionApiService,
  CalificacionRegistrada,
} from './calificacion-opinion-api.service';

@Component({
  selector: 'app-calificacion-opinion',
  template: `
    <section *ngIf="reservaId">
      <h2>Calificar el servicio</h2>

      <form *ngIf="!guardada" (ngSubmit)="registrar()">
        <label>
          Puntuación
          <input type="number" name="puntuacion" min="0" step="any"
            required [(ngModel)]="puntuacion" [disabled]="guardando">
        </label>

        <label>
          Opinión (opcional)
          <textarea name="opinion" rows="4" [(ngModel)]="opinion"
            [disabled]="guardando"></textarea>
        </label>

        <button class="btn" type="submit" [disabled]="guardando">
          Guardar calificación
        </button>
      </form>

      <p *ngIf="guardando" role="status">Guardando calificación…</p>
      <p *ngIf="guardada" role="status">Calificación guardada.</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
    </section>
  `,
})
export class CalificacionOpinionComponent implements OnChanges, OnDestroy {
  @Input() reservaId = '';

  puntuacion: number | null = null;
  opinion = '';
  guardada: CalificacionRegistrada | null = null;
  guardando = false;
  error = '';
  private envio = Subscription.EMPTY;

  constructor(private readonly api: CalificacionOpinionApiService) {}

  ngOnChanges(): void {
    this.envio.unsubscribe();
    this.puntuacion = null;
    this.opinion = '';
    this.guardada = null;
    this.error = '';
  }

  ngOnDestroy(): void {
    this.envio.unsubscribe();
  }

  registrar(): void {
    if (!this.reservaId || this.guardando || this.guardada) {
      return;
    }

    const puntuacion = this.puntuacion;
    if (puntuacion === null || !Number.isFinite(puntuacion) || puntuacion < 0) {
      this.error = 'Introduce una puntuación numérica mayor o igual a cero.';
      return;
    }

    this.error = '';
    this.guardando = true;

    this.envio = this.api.registrar(this.reservaId, puntuacion, this.opinion.trim() || null)
      .pipe(finalize(() => { this.guardando = false; }))
      .subscribe(
        (calificacion) => { this.guardada = calificacion; },
        (error: HttpErrorResponse) => {
          switch (error.status) {
            case 401:
              this.error = 'Inicia sesión para calificar el servicio.';
              break;
            case 403:
              this.error = 'Solo el cliente de la reserva puede calificar el servicio.';
              break;
            case 404:
              this.error = 'No se encontró la reserva.';
              break;
            case 409:
              this.error = 'La reserva debe estar finalizada para poder calificarla.';
              break;
            default:
              this.error = 'No se pudo guardar la calificación. Revisa los datos e intenta de nuevo.';
          }
        },
      );
  }
}
