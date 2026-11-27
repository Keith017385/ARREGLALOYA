import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';

interface AnticipoPendiente {
  id: string;
  reservaId: string;
  cliente: string;
  servicio: string;
  importe: string;
  referencia: string;
  fechaTransferencia: string;
  solicitadaEn: string;
  comprobanteDisponible: boolean;
}

@Component({
  selector: 'app-administracion-anticipos',
  template: `
    <header class="queue-heading">
      <div><span class="eyebrow">REVISIÓN FINANCIERA</span><h1>Anticipos por verificar</h1>
        <p>Compara la referencia con el movimiento bancario antes de acreditar el pago.</p></div>
      <button class="btn btn-outline" type="button" (click)="cargar()" [disabled]="cargando">Actualizar</button>
    </header>
    <p *ngIf="cargando" role="status">Cargando declaraciones…</p>
    <p *ngIf="error" class="feedback error" role="alert">{{ error }}</p>
    <p *ngIf="mensaje" class="feedback success" role="status">{{ mensaje }}</p>
    <section class="empty" *ngIf="!cargando && anticipos?.length === 0">No hay anticipos pendientes de verificación.</section>
    <article class="advance-review" *ngFor="let anticipo of anticipos">
      <div class="review-top">
        <div><span class="eyebrow">RESERVA #{{ anticipo.reservaId }} · DECLARACIÓN #{{ anticipo.id }}</span>
          <h2>{{ anticipo.cliente }}</h2><p>{{ anticipo.servicio }}</p></div>
        <strong class="amount">Bs {{ anticipo.importe }}</strong>
      </div>
      <dl>
        <div><dt>Referencia</dt><dd>{{ anticipo.referencia }}</dd></div>
        <div><dt>Transferencia</dt><dd>{{ anticipo.fechaTransferencia | date:'dd/MM/yyyy HH:mm':'-0400' }}</dd></div>
        <div><dt>Reportada</dt><dd>{{ anticipo.solicitadaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}</dd></div>
      </dl>
      <button *ngIf="anticipo.comprobanteDisponible" class="btn btn-outline" type="button"
        (click)="verComprobante(anticipo)" [disabled]="ocupado === anticipo.id">Ver comprobante</button>
      <form (ngSubmit)="resolver(anticipo, 'acreditada')">
        <label>Nota de revisión (opcional)
          <textarea [(ngModel)]="motivos[anticipo.id]" [name]="'motivo-' + anticipo.id" maxlength="1000" rows="2"></textarea>
        </label>
        <p class="helper">Verifica el abono en la cuenta bancaria antes de acreditar. Si rechazas, indica al menos 10 caracteres para explicar qué corregir.</p>
        <div class="review-actions">
          <button class="btn" type="submit" [disabled]="ocupado === anticipo.id">Acreditar pago</button>
          <button class="btn btn-outline reject" type="button" [disabled]="ocupado === anticipo.id"
            (click)="resolver(anticipo, 'rechazada')">Rechazar declaración</button>
        </div>
      </form>
    </article>
  `,
  styles: [`
    .queue-heading, .review-top { display: flex; justify-content: space-between; align-items: flex-start; gap: 1rem; }
    .queue-heading { margin-bottom: 1.25rem; }
    .eyebrow { color: #65457f; font-size: .72rem; font-weight: 700; letter-spacing: .1em; }
    h1, h2 { color: #173d59; margin: .35rem 0; }
    p { color: #536d7d; }
    .advance-review, .empty { margin: 1rem 0; padding: 1.25rem; border: 1px solid #cbdbe3; border-radius: 16px; background: #fff; box-shadow: 0 6px 20px rgba(25, 58, 79, .08); }
    .amount { padding: .55rem .75rem; border-radius: 10px; color: #533b72; background: #f1ebf7; white-space: nowrap; }
    dl { display: grid; gap: .45rem; margin: 1rem 0; }
    dl div { display: grid; grid-template-columns: 150px minmax(0, 1fr); gap: .5rem; }
    dt { color: #687b89; } dd { margin: 0; color: #173d59; font-weight: 600; overflow-wrap: anywhere; }
    form { display: grid; gap: .65rem; margin-top: 1rem; }
    label { display: grid; gap: .35rem; color: #28465d; font-weight: 600; }
    textarea { resize: vertical; padding: .65rem; border: 1px solid #c8d7df; border-radius: 9px; font: inherit; }
    .helper { margin: 0; font-size: .9rem; }
    .review-actions { display: flex; flex-wrap: wrap; gap: .6rem; }
    .reject { color: #9e334f; }
    .feedback { padding: .8rem 1rem; border-radius: 10px; }
    .feedback.error { color: #9e334f; background: #fff0f3; }
    .feedback.success { color: #245942; background: #f1faf5; }
    @media (max-width: 580px) { .queue-heading, .review-top { flex-direction: column; } dl div { grid-template-columns: 1fr; } }
  `],
})
export class AdministracionAnticiposComponent implements OnInit {
  anticipos: AnticipoPendiente[] | null = null;
  motivos: Record<string, string> = {};
  cargando = false;
  ocupado = '';
  error = '';
  mensaje = '';

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    if (this.cargando || this.ocupado) return;
    this.cargando = true;
    this.error = '';
    this.http.get<AnticipoPendiente[]>('/api/administracion/anticipos-pendientes').subscribe(
      anticipos => { this.anticipos = anticipos; this.cargando = false; },
      error => {
        this.cargando = false;
        this.anticipos = null;
        this.error = error.status === 403 ? 'Esta bandeja requiere una cuenta de administrador activa.'
          : error.status === 401 ? 'Inicia sesión para revisar anticipos.'
            : error.error?.message || 'No se pudo cargar la bandeja de anticipos.';
      },
    );
  }

  resolver(anticipo: AnticipoPendiente, decision: 'acreditada' | 'rechazada'): void {
    const motivo = (this.motivos[anticipo.id] || '').trim();
    if (decision === 'rechazada' && !motivo) {
      this.error = 'Escribe un motivo para que el cliente sepa qué corregir.';
      return;
    }
    this.ocupado = anticipo.id;
    this.error = '';
    this.mensaje = '';
    this.http.post('/api/administracion/anticipos/' + encodeURIComponent(anticipo.id) + '/resolucion', {
      decision, motivo,
    }).subscribe(
      () => {
        this.ocupado = '';
        this.mensaje = decision === 'acreditada'
          ? `Pago acreditado. La reserva #${anticipo.reservaId} quedó confirmada.`
          : `Declaración rechazada. El motivo aparecerá en el seguimiento de la reserva #${anticipo.reservaId}.`;
        this.cargar();
      },
      (error: HttpErrorResponse) => {
        this.ocupado = '';
        this.error = error.status === 403 ? 'Esta operación requiere un administrador activo.'
          : error.error?.message || 'No se pudo guardar la resolución. Actualiza la bandeja.';
      },
    );
  }

  verComprobante(anticipo: AnticipoPendiente): void {
    this.ocupado = anticipo.id;
    this.error = '';
    this.http.get('/api/administracion/anticipos/' + encodeURIComponent(anticipo.id) + '/comprobante', {
      responseType: 'blob',
    }).subscribe(
      archivo => {
        this.ocupado = '';
        const url = URL.createObjectURL(archivo);
        window.open(url, '_blank', 'noopener');
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
      },
      error => {
        this.ocupado = '';
        this.error = error.error?.message || 'No se pudo abrir el comprobante.';
      },
    );
  }
}
