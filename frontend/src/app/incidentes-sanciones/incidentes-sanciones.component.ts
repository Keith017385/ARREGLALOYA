import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy } from '@angular/core';
import { Observable, Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

interface Participante {
  usuarioId: string;
  participacion: string;
}

interface Incidente {
  id: string;
  reservaId: string | null;
  descripcion: string;
  confirmadoEn: string | null;
  confirmadoPorId: string | null;
  participantes: Participante[];
}

interface Confirmacion {
  confirmadoEn: string;
  confirmadoPorId: string;
}

const API = '/api/administracion/incidentes';

@Component({
  selector: 'app-incidentes-sanciones',
  template: `
    <h1>Incidentes y sanciones</h1>
    <p *ngIf="ocupado" role="status">Procesando solicitud…</p>
    <p *ngIf="mensaje" role="status">{{ mensaje }}</p>
    <p *ngIf="error" role="alert">{{ error }}</p>

    <form (submit)="$event.preventDefault(); registrar(reserva.value, descripcion.value)">
      <fieldset [disabled]="ocupado">
        <legend>Registrar un incidente</legend>
        <label>ID de la reserva
          <input #reserva inputmode="numeric" required pattern="[1-9][0-9]{0,18}">
        </label>
        <label>Descripción del incidente
          <textarea #descripcion rows="3" required></textarea>
        </label>
        <button class="btn" type="submit">Registrar incidente</button>
      </fieldset>
    </form>

    <form (submit)="$event.preventDefault(); consultar(incidenteId.value)">
      <fieldset [disabled]="ocupado">
        <legend>Consultar un incidente</legend>
        <label>ID del incidente
          <input #incidenteId inputmode="numeric" required pattern="[1-9][0-9]{0,18}">
        </label>
        <button class="btn btn-outline" type="submit">Consultar</button>
      </fieldset>
    </form>

    <article *ngIf="incidente as caso">
      <h2>Incidente #{{ caso.id }}</h2>
      <p *ngIf="caso.reservaId">Reserva #{{ caso.reservaId }}</p>
      <p class="descripcion">{{ caso.descripcion }}</p>

      <h3>Participantes</h3>
      <p *ngIf="caso.participantes.length === 0">El incidente no tiene participantes vinculados.</p>
      <ul>
        <li *ngFor="let participante of caso.participantes">
          Usuario #{{ participante.usuarioId }} · {{ participante.participacion }}
        </li>
      </ul>

      <ng-container *ngIf="caso.confirmadoEn; else pendiente">
        <p>Confirmado el {{ caso.confirmadoEn | date:'dd/MM/yyyy HH:mm':'-0400' }}.</p>
        <p *ngIf="caso.confirmadoPorId">Confirmado por el usuario #{{ caso.confirmadoPorId }}.</p>

        <form *ngIf="caso.participantes.length > 0"
          (submit)="$event.preventDefault(); sancionar(caso, usuario.value, motivo.value, inicio.value, fin.value)">
          <fieldset [disabled]="ocupado">
            <legend>Registrar una sanción</legend>
            <label>Participante
              <select #usuario required>
                <option value="">Selecciona un participante</option>
                <option *ngFor="let participante of caso.participantes" [value]="participante.usuarioId">
                  Usuario #{{ participante.usuarioId }} · {{ participante.participacion }}
                </option>
              </select>
            </label>
            <label>Motivo
              <textarea #motivo rows="3" required></textarea>
            </label>
            <label>Inicio, hora de Bolivia
              <input #inicio type="datetime-local" required>
            </label>
            <label>Fin, hora de Bolivia
              <input #fin type="datetime-local" required>
            </label>
            <button class="btn" type="submit">Registrar sanción</button>
          </fieldset>
        </form>
      </ng-container>

      <ng-template #pendiente>
        <p>Pendiente de confirmación.</p>
        <button class="btn" type="button" [disabled]="ocupado"
          (click)="confirmar(caso)">Confirmar incumplimiento</button>
      </ng-template>
    </article>
  `,
  styles: [`
    fieldset { display: grid; gap: 0.75rem; max-width: 36rem; margin: 1rem 0; }
    label { display: grid; gap: 0.25rem; }
    input, select, textarea { font: inherit; padding: 0.5rem; }
    button { justify-self: start; }
    .descripcion { white-space: pre-wrap; overflow-wrap: anywhere; }
  `],
})
export class IncidentesSancionesComponent implements OnDestroy {
  incidente: Incidente | null = null;
  ocupado = false;
  error = '';
  mensaje = '';
  private peticion = Subscription.EMPTY;

  constructor(private readonly http: HttpClient) {}

  ngOnDestroy(): void {
    this.peticion.unsubscribe();
  }

  registrar(reservaId: string, descripcion: string): void {
    if (this.ocupado) return;

    const texto = descripcion.trim();
    if (!texto) {
      this.error = 'Escribe la descripción del incidente.';
      return;
    }

    this.ejecutar(
      this.http.post<{ id: string }>(API, { reservaId: reservaId.trim(), descripcion: texto }),
      (nuevo) => {
        this.incidente = null;
        this.mensaje = `Incidente #${nuevo.id} registrado. Usa su ID para consultar el detalle.`;
      },
    );
  }

  consultar(incidenteId: string): void {
    if (this.ocupado) return;
    this.incidente = null;

    this.ejecutar(
      this.http.get<Incidente>(this.ruta(incidenteId.trim())),
      (caso) => { this.incidente = caso; },
    );
  }

  confirmar(caso: Incidente): void {
    if (this.ocupado || caso.confirmadoEn) return;

    this.ejecutar(
      this.http.post<Confirmacion>(`${this.ruta(caso.id)}/confirmacion`, {}),
      (confirmacion) => {
        this.incidente = { ...caso, ...confirmacion };
        this.mensaje = `Incumplimiento del incidente #${caso.id} confirmado.`;
      },
    );
  }

  sancionar(caso: Incidente, usuarioId: string, motivo: string, inicio: string, fin: string): void {
    if (this.ocupado || !caso.confirmadoEn) return;

    const desde = this.fechaBolivia(inicio);
    const hasta = this.fechaBolivia(fin);
    if (!motivo.trim() || !desde || !hasta || hasta <= desde) {
      this.error = 'Escribe un motivo y verifica que el fin sea posterior al inicio.';
      return;
    }

    this.ejecutar(
      this.http.post<{ id: string }>(`${this.ruta(caso.id)}/sanciones`, {
        usuarioId,
        motivo: motivo.trim(),
        inicio: desde.toISOString(),
        fin: hasta.toISOString(),
      }),
      (sancion) => { this.mensaje = `Sanción #${sancion.id} registrada.`; },
    );
  }

  private fechaBolivia(valor: string): Date | null {
    if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}$/.test(valor)) return null;
    const fecha = new Date(`${valor}:00-04:00`);
    if (!Number.isFinite(fecha.getTime())) return null;
    const horaLocal = new Date(fecha.getTime() - 4 * 60 * 60 * 1000);
    return horaLocal.toISOString().slice(0, 16) === valor ? fecha : null;
  }

  private ruta(incidenteId: string): string {
    return `${API}/${encodeURIComponent(incidenteId)}`;
  }

  private ejecutar<T>(peticion: Observable<T>, alCompletar: (resultado: T) => void): void {
    this.error = '';
    this.mensaje = '';
    this.ocupado = true;

    this.peticion = peticion.pipe(finalize(() => { this.ocupado = false; })).subscribe(
      alCompletar,
      (error: HttpErrorResponse) => {
        if (error.status === 401 || error.status === 403) {
          this.incidente = null;
          this.error = error.status === 401
            ? 'Inicia sesión para gestionar los incidentes.'
            : 'Se requiere una cuenta de administrador activa.';
          return;
        }

        const detalle = error.error && error.error.message;
        this.error = [400, 404, 409].indexOf(error.status) >= 0 && typeof detalle === 'string'
          ? detalle
          : 'No se pudo completar la operación. Consulta el incidente antes de reintentar.';
      },
    );
  }
}