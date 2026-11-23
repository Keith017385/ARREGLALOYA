import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

interface RevisionAsistencia {
  respuestaId: string;
  asistenciaId: string;
  reservaId: string;
  declaradaEn: string;
  rechazadaEn: string;
  escaladaEn: string | null;
  estado: 'en_revision' | 'vencida' | 'escalada';
}

interface GestionRegistrada {
  respuestaId: string;
  escaladaEn: string | null;
  responsableId: string | null;
}

const API = '/api/superadministracion/revisiones-asistencia';

@Component({
  selector: 'app-gestion-revision-asistencia',
  template: `
    <h1>Revisiones de asistencia</h1>
    <p *ngIf="ocupado" role="status">Procesando solicitud…</p>
    <p *ngIf="mensaje" role="status">{{ mensaje }}</p>
    <p *ngIf="error" role="alert">{{ error }}</p>

    <ng-container *ngIf="revisiones as lista">
      <p *ngIf="lista.length === 0">No hay revisiones abiertas.</p>
      <p *ngIf="lista.length === 50">Se muestran hasta 50 revisiones abiertas.</p>

      <article *ngFor="let caso of lista">
        <h2>Reserva #{{ caso.reservaId }} · Respuesta #{{ caso.respuestaId }}</h2>
        <p>Declaración #{{ caso.asistenciaId }} del
          {{ caso.declaradaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}.</p>
        <p>Rechazada el {{ caso.rechazadaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}.</p>
        <p>Estado: {{ etiquetas[caso.estado] }}.</p>

        <button *ngIf="caso.estado === 'vencida'" class="btn" type="button"
          [disabled]="ocupado || requiereActualizar" (click)="escalar(caso)">
          Escalar revisión
        </button>

        <form *ngIf="caso.estado === 'escalada'"
          (submit)="$event.preventDefault(); resolver(caso, decision.value)">
          <p *ngIf="caso.escaladaEn">
            Escalada el {{ caso.escaladaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}.
          </p>
          <fieldset [disabled]="ocupado || requiereActualizar">
            <legend>Registrar decisión</legend>
            <label>Resolución y motivo
              <textarea #decision required maxlength="2000" rows="4"></textarea>
            </label>
            <button class="btn" type="submit">Guardar resolución</button>
          </fieldset>
        </form>
      </article>
    </ng-container>

    <button class="btn btn-outline" type="button" [disabled]="ocupado" (click)="cargar()">
      Actualizar bandeja
    </button>
    <a href="?candidatosAsistencia=1">Consultar candidatos a escalamiento</a>
  `,
  styles: [`
    article { border-bottom: 1px solid #ddd; padding: 1rem 0; }
    fieldset { display: grid; gap: 0.75rem; max-width: 36rem; }
    label { display: grid; gap: 0.25rem; }
    textarea { font: inherit; padding: 0.5rem; }
    fieldset button { justify-self: start; }
    a { margin-left: 0.75rem; }
  `],
})
export class GestionRevisionAsistenciaComponent implements OnInit, OnDestroy {
  readonly etiquetas = {
    en_revision: 'En revisión',
    vencida: 'Plazo vencido',
    escalada: 'Escalada',
  };

  revisiones: RevisionAsistencia[] | null = null;
  ocupado = false;
  requiereActualizar = false;
  error = '';
  mensaje = '';
  private peticion = Subscription.EMPTY;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.peticion.unsubscribe();
  }

  cargar(): void {
    if (this.ocupado) return;

    this.revisiones = null;
    this.ejecutar(this.http.get<RevisionAsistencia[]>(API), (revisiones) => {
      this.revisiones = revisiones;
      this.requiereActualizar = false;
    });
  }

  escalar(caso: RevisionAsistencia): void {
    if (this.ocupado || this.requiereActualizar || caso.estado !== 'vencida') return;

    this.ejecutar(
      this.http.post<GestionRegistrada>(`${this.ruta(caso.respuestaId)}/escalamiento`, {}),
      (guardada) => {
        this.revisiones = (this.revisiones || []).map((fila) =>
          fila.respuestaId === guardada.respuestaId
            ? { ...fila, estado: 'escalada', escaladaEn: guardada.escaladaEn }
            : fila,
        );
        this.mensaje = `Revisión #${guardada.respuestaId} escalada.`;
      },
    );
  }

  resolver(caso: RevisionAsistencia, decision: string): void {
    if (this.ocupado || this.requiereActualizar || caso.estado !== 'escalada') return;

    const resolucion = decision.trim();
    if (!resolucion || Array.from(resolucion).length > 2000 || resolucion.indexOf('\0') >= 0) {
      this.error = 'Escribe una resolución válida de entre 1 y 2000 caracteres.';
      return;
    }

    this.ejecutar(
      this.http.post<GestionRegistrada>(`${this.ruta(caso.respuestaId)}/resolucion`, { resolucion }),
      (guardada) => {
        this.revisiones = (this.revisiones || [])
          .filter((fila) => fila.respuestaId !== guardada.respuestaId);
        this.mensaje = `Resolución guardada para la respuesta #${guardada.respuestaId}.`;
      },
    );
  }

  private ruta(respuestaId: string): string {
    return `${API}/${encodeURIComponent(respuestaId)}`;
  }

  private ejecutar<T>(peticion: Observable<T>, alCompletar: (resultado: T) => void): void {
    this.error = '';
    this.mensaje = '';
    this.ocupado = true;

    this.peticion = peticion.pipe(finalize(() => { this.ocupado = false; })).subscribe(
      alCompletar,
      (error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          this.revisiones = null;
          this.error = error.status === 401
            ? 'Inicia sesión para gestionar las revisiones de asistencia.'
            : 'Se requiere una cuenta de superadministrador activa.';
          return;
        }

        const detalle = error.error && error.error.message;
        if (error.status === 400 && typeof detalle === 'string') {
          this.error = detalle;
          return;
        }

        this.requiereActualizar = true;
        this.error = (error.status === 404 || error.status === 409) && typeof detalle === 'string'
          ? `${detalle} Actualiza la bandeja antes de continuar.`
          : 'No se pudo completar la operación. Actualiza la bandeja para comprobar el estado.';
      },
    );
  }
}