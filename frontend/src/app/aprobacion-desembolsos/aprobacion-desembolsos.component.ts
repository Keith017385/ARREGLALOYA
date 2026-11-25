import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { AprobacionDesembolsosApiService, SolicitudDesembolso } from './aprobacion-desembolsos-api.service';

@Component({
  selector: 'app-aprobacion-desembolsos',
  template: `
    <section aria-labelledby="desembolso-titulo">
      <h1 id="desembolso-titulo">CU-23 · Aprobar desembolsos</h1>
      <p>Revisa el importe solicitado y el fondo disponible antes de aprobar o rechazar cada solicitud.</p>
      <p class="note"><strong>Documentación:</strong> el esquema PostgreSQL actual no contiene una tabla que vincule archivos con solicitudes financieras de desembolso. Por eso esta pantalla presenta los datos financieros, pero no puede mostrar adjuntos del trabajador.</p>
      <p *ngIf="cargando" role="status">Consultando solicitudes de desembolso…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="mensaje" role="status">{{ mensaje }}</p>
      <p *ngIf="solicitudes && solicitudes.length === 0">No hay solicitudes de desembolso pendientes.</p>

      <div class="request-list" *ngIf="solicitudes as lista">
        <article class="request-card" *ngFor="let solicitud of lista">
          <div>
            <h2>Solicitud #{{ solicitud.solicitudFinancieraId }} · Reserva #{{ solicitud.reservaId }}</h2>
            <p><strong>Trabajador:</strong> {{ solicitud.trabajadorNombre }} ({{ solicitud.trabajadorId }})</p>
            <p><strong>Cliente:</strong> {{ solicitud.clienteNombre }}</p>
            <p><strong>Solicitado:</strong> {{ solicitud.importeSolicitadoCentavos / 100 | currency:'BOB':'Bs ' }}</p>
            <p><strong>Disponible según el fondo:</strong> {{ solicitud.disponibleCentavos / 100 | currency:'BOB':'Bs ' }}</p>
            <p><strong>Reserva:</strong> {{ solicitud.reservaEstado }} · {{ solicitud.solicitadaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}</p>
            <p *ngIf="solicitud.reclamoEnRevision" class="warning">Esta solicitud está vinculada a un reclamo en revisión. La transferencia no podrá ejecutarse hasta que se resuelva el reclamo.</p>
          </div>
          <button class="btn btn-outline" type="button" (click)="seleccionar(solicitud)" [disabled]="guardando">Tomar decisión</button>
        </article>
      </div>

      <form *ngIf="seleccionada as solicitud" class="decision-form" (ngSubmit)="confirmar()">
        <h2>Decisión para solicitud #{{ solicitud.solicitudFinancieraId }}</h2>
        <p>Solicitado: {{ solicitud.importeSolicitadoCentavos / 100 | currency:'BOB':'Bs ' }} · Disponible: {{ solicitud.disponibleCentavos / 100 | currency:'BOB':'Bs ' }}</p>
        <label for="desembolso-decision">Decisión</label>
        <select id="desembolso-decision" name="decision" [(ngModel)]="decision">
          <option value="aprobada">Aprobar</option>
          <option value="rechazada">Rechazar</option>
        </select>
        <ng-container *ngIf="decision === 'aprobada'">
          <label for="desembolso-importe">Importe autorizado en Bs (máximo solicitado y fondo disponible)</label>
          <input id="desembolso-importe" type="text" name="importeBs" [(ngModel)]="importeBs" placeholder="Ej. 150.00" [disabled]="guardando">
        </ng-container>
        <label for="desembolso-motivo">Motivo de la decisión</label>
        <textarea id="desembolso-motivo" name="motivo" rows="3" maxlength="2000"
          [(ngModel)]="motivo" required [disabled]="guardando"></textarea>
        <div class="actions">
          <button class="btn" type="submit" [disabled]="guardando || !motivo.trim() || (decision === 'aprobada' && !importeBs.trim())">
            {{ guardando ? 'Registrando…' : 'Registrar decisión' }}
          </button>
          <button class="btn btn-outline" type="button" (click)="cancelar()" [disabled]="guardando">Cancelar</button>
        </div>
      </form>
      <p class="note">Aprobar crea una autorización y un compromiso transaccional del fondo. No realiza la transferencia. El movimiento y su confirmación pertenecen al proceso financiero posterior.</p>
    </section>
  `,
  styles: [`
    .request-list{display:grid;gap:.8rem;max-width:65rem}.request-card{display:flex;justify-content:space-between;gap:1rem;align-items:center;border:1px solid #ddd;border-radius:10px;padding:1rem}
    .request-card h2{font-size:1.05rem;margin:0 0 .5rem}.request-card p{margin:.3rem 0;overflow-wrap:anywhere}
    .decision-form{display:grid;gap:.65rem;max-width:38rem;border:1px solid #aaa;border-radius:10px;padding:1rem;margin:1.2rem 0}
    textarea,input,select{font:inherit;padding:.55rem;max-width:100%}.actions{display:flex;gap:.7rem;flex-wrap:wrap}.note{color:#555;max-width:65rem}.warning{font-weight:600}
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

  cargar(): void {
    if (this.cargando || this.guardando) return;
    this.error = ''; this.cargando = true;
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
    this.importeBs = (solicitud.importeSolicitadoCentavos / 100).toFixed(2);
    this.motivo = '';
    this.error = ''; this.mensaje = '';
  }

  cancelar(): void { this.seleccionada = null; this.importeBs = ''; this.motivo = ''; }

  confirmar(): void {
    const solicitud = this.seleccionada;
    const motivo = this.motivo.trim();
    if (!solicitud || !motivo || this.guardando) return;
    let importeCentavos: number | null = null;
    if (this.decision === 'aprobada') {
      importeCentavos = this.convertirABsCentavos(this.importeBs);
      if (importeCentavos === null || importeCentavos <= 0) {
        this.error = 'Introduce un importe válido con hasta dos decimales.';
        return;
      }
    }
    this.guardando = true; this.error = ''; this.mensaje = '';
    this.operaciones.add(this.api.decidirDesembolso(
      solicitud.solicitudFinancieraId, this.decision, importeCentavos, motivo,
    ).pipe(finalize(() => { this.guardando = false; }))
      .subscribe(
        () => {
          this.guardando = false;
          this.mensaje = this.decision === 'aprobada'
            ? `Se aprobó la solicitud #${solicitud.solicitudFinancieraId}. El importe quedó comprometido, no transferido.`
            : `Se rechazó la solicitud #${solicitud.solicitudFinancieraId}.`;
          this.seleccionada = null; this.importeBs = ''; this.motivo = ''; this.cargar();
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
    return typeof detalle === 'string' ? detalle : 'No se pudo registrar la decisión del desembolso.';
  }
}
