import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import {
  AprobacionDesembolsosApiService,
  SolicitudDesembolso,
} from './aprobacion-desembolsos-api.service';

@Component({
  selector: 'app-aprobacion-desembolsos',
  template: `
    <section aria-labelledby="desembolso-titulo">
      <h1 id="desembolso-titulo">Control de desembolsos</h1>
      <p>
        Verifica el respaldo, el estado de la reserva, los reclamos y el fondo disponible
        antes de autorizar una transferencia.
      </p>

      <p *ngIf="cargando" role="status">Consultando solicitudes…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="mensaje" role="status">{{ mensaje }}</p>
      <p *ngIf="solicitudes && solicitudes.length === 0">
        No hay solicitudes de desembolso pendientes de decisión.
      </p>

      <div class="request-list" *ngIf="solicitudes as lista">
        <article class="request-card" *ngFor="let solicitud of lista">
          <div class="request-data">
            <h2>Solicitud #{{ solicitud.solicitudFinancieraId }} · Reserva #{{ solicitud.reservaId }}</h2>
            <p><strong>Trabajador:</strong> {{ solicitud.trabajadorNombre }} ({{ solicitud.trabajadorId }})</p>
            <p><strong>Cliente:</strong> {{ solicitud.clienteNombre }}</p>
            <p><strong>Estado de reserva:</strong> {{ solicitud.reservaEstado }}</p>
            <p><strong>Solicitado:</strong> {{ solicitud.importeSolicitadoCentavos / 100 | currency:'BOB':'Bs ' }}</p>
            <p><strong>Fondo disponible para esta solicitud:</strong>
              {{ solicitud.disponibleCentavos / 100 | currency:'BOB':'Bs ' }}
            </p>
            <p><strong>Máximo autorizable:</strong>
              {{ solicitud.importeMaximoAutorizableCentavos / 100 | currency:'BOB':'Bs ' }}
            </p>
            <p><strong>Fecha:</strong> {{ solicitud.solicitadaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}</p>
            <p>
              <strong>Respaldo:</strong>
              <a *ngIf="solicitud.documentoDisponible"
                 [href]="urlDocumento(solicitud.solicitudFinancieraId)"
                 target="_blank" rel="noopener">Descargar PDF</a>
              <span *ngIf="!solicitud.documentoDisponible" class="blocked">No disponible</span>
            </p>
            <ul class="blocked-list" *ngIf="solicitud.motivosBloqueo.length">
              <li *ngFor="let bloqueo of solicitud.motivosBloqueo">{{ bloqueo }}</li>
            </ul>
            <p class="eligible" *ngIf="solicitud.puedeAprobar">Cumple las condiciones actuales para solicitar autorización.</p>
          </div>
          <button class="btn btn-outline" type="button"
                  (click)="seleccionar(solicitud)" [disabled]="guardando">
            Revisar solicitud
          </button>
        </article>
      </div>

      <form *ngIf="seleccionada as solicitud" class="decision-form" (ngSubmit)="confirmar()">
        <h2>Decisión de solicitud #{{ solicitud.solicitudFinancieraId }}</h2>
        <p>
          Solicitado: {{ solicitud.importeSolicitadoCentavos / 100 | currency:'BOB':'Bs ' }}
          · Máximo autorizable: {{ solicitud.importeMaximoAutorizableCentavos / 100 | currency:'BOB':'Bs ' }}
        </p>

        <label for="desembolso-decision">Decisión</label>
        <select id="desembolso-decision" name="decision" [(ngModel)]="decision" [disabled]="guardando">
          <option value="aprobada">Aprobar</option>
          <option value="rechazada">Rechazar</option>
        </select>

        <ng-container *ngIf="decision === 'aprobada'">
          <label for="desembolso-importe">Importe autorizado (Bs)</label>
          <input id="desembolso-importe" type="text" name="importeBs"
                 [(ngModel)]="importeBs" [disabled]="guardando"
                 [placeholder]="'Máximo ' + (solicitud.importeMaximoAutorizableCentavos / 100).toFixed(2)">
          <p class="blocked" *ngIf="!solicitud.puedeAprobar">
            Esta solicitud no puede aprobarse hasta resolver las condiciones indicadas en la lista.
          </p>
        </ng-container>

        <label for="desembolso-motivo">Justificación de la decisión</label>
        <textarea id="desembolso-motivo" name="motivo" rows="3" maxlength="2000"
                  [(ngModel)]="motivo" required [disabled]="guardando"></textarea>

        <div class="actions">
          <button class="btn" type="submit"
                  [disabled]="guardando || !motivo.trim() ||
                    (decision === 'aprobada' && (!solicitud.puedeAprobar || !importeBs.trim()))">
            {{ guardando ? 'Registrando…' : 'Registrar decisión' }}
          </button>
          <button class="btn btn-outline" type="button" (click)="cancelar()" [disabled]="guardando">
            Cancelar
          </button>
        </div>
      </form>

      <p class="note">
        La aprobación registra una decisión y compromete el importe conforme a las reglas de
        PostgreSQL. No ejecuta una transferencia bancaria; el movimiento se confirma en el
        proceso financiero posterior.
      </p>
    </section>
  `,
  styles: [`
    .request-list{display:grid;gap:.8rem;max-width:68rem}
    .request-card{display:flex;justify-content:space-between;gap:1rem;align-items:flex-start;border:1px solid #ddd;border-radius:10px;padding:1rem}
    .request-data{min-width:0}.request-card h2{font-size:1.05rem;margin:0 0 .5rem}
    .request-card p{margin:.3rem 0;overflow-wrap:anywhere}
    .decision-form{display:grid;gap:.65rem;max-width:38rem;border:1px solid #aaa;border-radius:10px;padding:1rem;margin:1.2rem 0}
    textarea,input,select{font:inherit;padding:.55rem;max-width:100%}
    .actions{display:flex;gap:.7rem;flex-wrap:wrap}.note{color:#555;max-width:68rem}
    .blocked{color:#9a3412;font-weight:600}.blocked-list{color:#9a3412;margin:.45rem 0;padding-left:1.2rem}
    .eligible{color:#166534;font-weight:600}
    @media(max-width:700px){.request-card{flex-direction:column;align-items:flex-start}}
  `],
})
export class AprobacionDesembolsosComponent implements OnInit, OnDestroy {
  solicitudes: SolicitudDesembolso[] | null = null;
  seleccionada: SolicitudDesembolso | null = null;
  decision: 'aprobada' | 'rechazada' = 'aprobada';
  importeBs = '';
  motivo = '';
  cargando = false;
  guardando = false;
  error = '';
  mensaje = '';
  private operaciones = new Subscription();

  constructor(private readonly api: AprobacionDesembolsosApiService) {}

  ngOnInit(): void { this.cargar(); }
  ngOnDestroy(): void { this.operaciones.unsubscribe(); }

  urlDocumento(solicitudId: string): string {
    return `/api/administracion/desembolsos/${encodeURIComponent(solicitudId)}/documento`;
  }

  cargar(): void {
    if (this.cargando || this.guardando) return;
    this.error = '';
    this.cargando = true;
    this.operaciones.add(this.api.listarDesembolsos()
      .pipe(finalize(() => { this.cargando = false; }))
      .subscribe(
        (solicitudes) => { this.solicitudes = solicitudes; },
        (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      ));
  }

  seleccionar(solicitud: SolicitudDesembolso): void {
    this.seleccionada = solicitud;
    this.decision = 'aprobada';
    this.importeBs = (solicitud.importeMaximoAutorizableCentavos / 100).toFixed(2);
    this.motivo = '';
    this.error = '';
    this.mensaje = '';
  }

  cancelar(): void {
    this.seleccionada = null;
    this.importeBs = '';
    this.motivo = '';
  }

  confirmar(): void {
    const solicitud = this.seleccionada;
    const motivo = this.motivo.trim();
    if (!solicitud || !motivo || this.guardando) return;

    let importeCentavos: number | null = null;
    if (this.decision === 'aprobada') {
      if (!solicitud.puedeAprobar) {
        this.error = 'La solicitud no cumple las condiciones de transferencia.';
        return;
      }
      importeCentavos = this.convertirABsCentavos(this.importeBs);
      if (importeCentavos === null || importeCentavos <= 0) {
        this.error = 'Introduce un importe positivo con hasta dos decimales.';
        return;
      }
      if (importeCentavos > solicitud.importeSolicitadoCentavos
          || importeCentavos > solicitud.disponibleCentavos) {
        this.error = 'El importe supera el máximo solicitado o el fondo disponible.';
        return;
      }
    }

    this.guardando = true;
    this.error = '';
    this.mensaje = '';
    this.operaciones.add(this.api.decidirDesembolso(
      solicitud.solicitudFinancieraId,
      this.decision,
      importeCentavos,
      motivo,
    ).pipe(finalize(() => { this.guardando = false; }))
      .subscribe(
        (respuesta) => {
          this.guardando = false;
          this.mensaje = respuesta.decision === 'aprobada'
            ? `Solicitud #${solicitud.solicitudFinancieraId} autorizada. El importe quedó comprometido, no transferido.`
            : `Solicitud #${solicitud.solicitudFinancieraId} rechazada.`;
          this.seleccionada = null;
          this.importeBs = '';
          this.motivo = '';
          this.cargar();
        },
        (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      ));
  }

  private convertirABsCentavos(valor: string): number | null {
    const texto = valor.trim().replace(',', '.');
    const coincidencia = /^(\d+)(?:\.(\d{1,2}))?$/.exec(texto);
    if (!coincidencia) return null;
    const enteros = Number(coincidencia[1]);
    const decimales = Number((coincidencia[2] || '').padEnd(2, '0'));
    const centavos = enteros * 100 + decimales;
    return Number.isSafeInteger(centavos) ? centavos : null;
  }

  private mensajeError(error: HttpErrorResponse): string {
    if (error.status === 401) return 'Inicia sesión para acceder a las funciones administrativas.';
    if (error.status === 403) return 'Tu cuenta no tiene permisos de administrador.';
    const detalle = error.error && error.error.message;
    return typeof detalle === 'string'
      ? detalle
      : 'No se pudo registrar la decisión del desembolso.';
  }
}
