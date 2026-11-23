import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, Input, OnChanges, OnDestroy } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

interface RespuestaOpinion {
  id: string;
  autorId: string;
  texto: string;
  registradaEn: string;
}

interface DetalleOpinion {
  calificacionId: string;
  reservaId: string;
  opinion: string | null;
  puedeResponder: boolean;
  respuestas: RespuestaOpinion[];
}

@Component({
  selector: 'app-respuesta-opinion',
  template: `
    <h1>Opinión sobre el servicio</h1>
    <p *ngIf="cargando" role="status">Consultando la opinión…</p>
    <p *ngIf="mensaje" role="status">{{ mensaje }}</p>
    <p *ngIf="error" role="alert">{{ error }}</p>

    <article *ngIf="detalle as caso">
      <p>Reserva #{{ caso.reservaId }}</p>
      <p *ngIf="caso.opinion; else sinOpinion" class="texto">{{ caso.opinion }}</p>
      <ng-template #sinOpinion>
        <p>Esta calificación no tiene una opinión escrita.</p>
      </ng-template>

      <h2>Respuestas del trabajador</h2>
      <p *ngIf="caso.respuestas.length === 0">Todavía no hay respuestas.</p>
      <ul *ngIf="caso.respuestas.length > 0">
        <li *ngFor="let respuesta of caso.respuestas">
          <strong>Trabajador #{{ respuesta.autorId }}</strong>
          <time [attr.datetime]="respuesta.registradaEn">
            {{ respuesta.registradaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}
          </time>
          <p class="texto">{{ respuesta.texto }}</p>
        </li>
      </ul>

      <form *ngIf="caso.puedeResponder"
        (submit)="$event.preventDefault(); responder(campo.value, formulario)"
        #formulario>
        <fieldset [disabled]="cargando || guardando || requiereActualizar">
          <legend>Responder a la opinión</legend>
          <label>Tu respuesta
            <textarea #campo rows="4" required></textarea>
          </label>
          <button class="btn" type="submit">
            {{ guardando ? 'Publicando…' : 'Publicar respuesta' }}
          </button>
        </fieldset>
      </form>
    </article>

    <button type="button" class="btn btn-outline" [disabled]="cargando || guardando"
      (click)="cargar()">Actualizar opinión</button>
  `,
  styles: [`
    .texto { white-space: pre-wrap; overflow-wrap: anywhere; }
    li { margin-bottom: 1rem; }
    time { margin-left: 0.5rem; }
    fieldset { display: grid; gap: 0.75rem; max-width: 36rem; margin-bottom: 1rem; }
    label { display: grid; gap: 0.25rem; }
    textarea { font: inherit; padding: 0.5rem; resize: vertical; }
    fieldset button { justify-self: start; }
  `],
})
export class RespuestaOpinionComponent implements OnChanges, OnDestroy {
  @Input() calificacionId = '';

  detalle: DetalleOpinion | null = null;
  cargando = false;
  guardando = false;
  requiereActualizar = false;
  mensaje = '';
  error = '';
  private consulta = Subscription.EMPTY;
  private envio = Subscription.EMPTY;

  constructor(private readonly http: HttpClient) {}

  ngOnChanges(): void {
    this.consulta.unsubscribe();
    this.envio.unsubscribe();
    this.detalle = null;
    this.cargar();
  }

  ngOnDestroy(): void {
    this.consulta.unsubscribe();
    this.envio.unsubscribe();
  }

  cargar(): void {
    if (!this.calificacionId || this.cargando || this.guardando) return;

    this.detalle = null;
    this.error = '';
    this.mensaje = '';
    this.cargando = true;

    this.consulta = this.http.get<DetalleOpinion>(this.ruta())
      .pipe(finalize(() => { this.cargando = false; }))
      .subscribe(
        (detalle) => {
          this.detalle = detalle;
          this.requiereActualizar = false;
        },
        (error: HttpErrorResponse) => { this.mostrarError(error); },
      );
  }

  responder(valor: string, formulario: HTMLFormElement): void {
    const caso = this.detalle;
    if (!caso || !caso.puedeResponder || this.guardando
        || this.cargando || this.requiereActualizar) return;

    const texto = valor.trim();
    if (!texto || texto.indexOf('\0') >= 0) {
      this.error = 'Escribe un texto válido para la respuesta.';
      return;
    }

    this.error = '';
    this.mensaje = '';
    this.guardando = true;

    this.envio = this.http.post<RespuestaOpinion>(`${this.ruta()}/respuestas`, { texto })
      .pipe(finalize(() => { this.guardando = false; }))
      .subscribe(
        (respuesta) => {
          this.detalle = { ...caso, respuestas: [...caso.respuestas, respuesta] };
          formulario.reset();
          this.mensaje = 'Respuesta publicada.';
        },
        (error: HttpErrorResponse) => {
          if (error.status !== 400) this.requiereActualizar = true;
          this.mostrarError(error);
        },
      );
  }

  private ruta(): string {
    return `/api/calificaciones/${encodeURIComponent(this.calificacionId)}/opinion`;
  }

  private mostrarError(error: HttpErrorResponse): void {
    switch (error.status) {
      case 401:
        this.detalle = null;
        this.error = 'Inicia sesión para consultar o responder la opinión.';
        break;
      case 403:
        this.error = 'Solo el trabajador contratado y activo puede responder.';
        break;
      case 404:
        this.detalle = null;
        this.error = 'La calificación no está disponible.';
        break;
      case 409:
        this.error = 'La opinión o el permiso cambió. Actualiza la opinión antes de continuar.';
        break;
      case 400:
        this.error = 'Revisa el texto de la respuesta.';
        break;
      default:
        this.error = 'No se pudo completar la operación. Actualiza la opinión antes de reintentar.';
    }
  }
}