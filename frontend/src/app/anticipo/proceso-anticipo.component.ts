import { HttpClient } from '@angular/common/http';
import { Component, Input, OnChanges, SimpleChanges } from '@angular/core';

interface InstruccionesPago {
  configurado: boolean;
  banco: string | null;
  beneficiario: string | null;
  cuenta: string | null;
  qrUrl: string | null;
}

interface ProcesoAnticipo {
  reservaId: string;
  estadoReserva: string;
  importe: string;
  pagoAcreditado: boolean;
  instrucciones: InstruccionesPago;
  declaracion: null | {
    id: string;
    estado: 'pendiente' | 'acreditada' | 'rechazada';
    referencia: string;
    fechaTransferencia: string;
    solicitadaEn: string;
    motivoRevision: string | null;
  };
}

@Component({
  selector: 'app-proceso-anticipo',
  template: `
    <section class="advance-card" *ngIf="proceso || cargando || error" aria-labelledby="advance-title">
      <div class="advance-heading">
        <div>
          <span class="eyebrow">SEGUIMIENTO DE RESERVA #{{ reservaId }}</span>
          <h3 id="advance-title">Proceso de tu servicio</h3>
        </div>
        <button type="button" class="btn btn-outline" (click)="cargar()" [disabled]="cargando || enviando">Actualizar</button>
      </div>

      <p *ngIf="cargando" role="status">Consultando el estado del anticipo…</p>
      <p *ngIf="error" class="feedback error" role="alert">{{ error }}</p>
      <ng-container *ngIf="proceso">
        <ol class="steps" aria-label="Etapas de la reserva">
          <li class="done"><span>1</span><div><strong>Cotización aceptada</strong><small>El trabajador y el precio quedaron acordados.</small></div></li>
          <li [class.done]="proceso.pagoAcreditado"
              [class.current]="!proceso.pagoAcreditado && proceso.estadoReserva === 'pendiente_anticipo'">
            <span>2</span><div><strong>Anticipo · Bs {{ proceso.importe }}</strong><small>{{ textoEstadoAnticipo() }}</small></div>
          </li>
          <li [class.done]="pagoAcreditadoYReservaActiva()"
              [class.current]="pagoAcreditadoYReservaActiva() && proceso.estadoReserva !== 'finalizada'">
            <span>3</span><div><strong>Reserva confirmada</strong><small>El trabajador puede coordinar el inicio.</small></div>
          </li>
          <li [class.done]="proceso.estadoReserva === 'finalizada'"><span>4</span><div><strong>Servicio terminado</strong><small>Luego podrás revisar el pago final y calificar.</small></div></li>
        </ol>

        <div class="payment-status" [class.pending]="proceso.estadoReserva === 'pendiente_anticipo'"
             [class.success]="proceso.pagoAcreditado">
          <strong>{{ tituloEstadoAnticipo() }}</strong>
          <p *ngIf="proceso.declaracion?.estado === 'pendiente'">
            Reportaste el pago el {{ proceso.declaracion?.solicitadaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}.
            Administración verificará la transferencia antes de confirmar la reserva.
          </p>
          <p *ngIf="proceso.declaracion?.estado === 'rechazada'">
            {{ proceso.declaracion?.motivoRevision || 'La transferencia no pudo verificarse.' }}
            Revisa los datos y vuelve a reportar el pago.
          </p>
          <p *ngIf="proceso.pagoAcreditado">
            El anticipo fue conciliado. Estado actual de la reserva: {{ proceso.estadoReserva }}.
          </p>
          <p *ngIf="proceso.estadoReserva === 'cancelada' && !proceso.pagoAcreditado">La reserva fue cancelada antes de que se acreditara el anticipo.</p>
        </div>

        <ng-container *ngIf="proceso.estadoReserva === 'pendiente_anticipo' && !proceso.pagoAcreditado && proceso.declaracion?.estado !== 'pendiente'">
          <div class="transfer-panel" *ngIf="proceso.instrucciones.configurado; else noTransferConfigured">
            <div>
              <span class="eyebrow">PAGO POR TRANSFERENCIA</span>
              <h4>Realiza el pago exacto del anticipo</h4>
              <dl>
                <div><dt>Banco</dt><dd>{{ proceso.instrucciones.banco }}</dd></div>
                <div><dt>Titular</dt><dd>{{ proceso.instrucciones.beneficiario }}</dd></div>
                <div><dt>Número de cuenta</dt><dd>{{ proceso.instrucciones.cuenta }}</dd></div>
                <div><dt>Importe</dt><dd>Bs {{ proceso.importe }}</dd></div>
              </dl>
              <img *ngIf="proceso.instrucciones.qrUrl" class="payment-qr" [src]="proceso.instrucciones.qrUrl" alt="QR de pago">
            </div>
            <form class="payment-form" #formulario="ngForm" (ngSubmit)="enviar()">
              <h4>Ya transferí, reportar pago</h4>
              <label>Referencia o número de transacción
                <input name="referencia" [(ngModel)]="referencia" required maxlength="160" autocomplete="off">
              </label>
              <label>Fecha y hora de la transferencia
                <input type="datetime-local" name="fechaTransferencia" [(ngModel)]="fechaTransferencia" required>
              </label>
              <label>Comprobante (opcional, PDF, PNG o JPG; máximo 5 MB)
                <input type="file" accept="application/pdf,image/png,image/jpeg" (change)="seleccionarComprobante($event)">
              </label>
              <small *ngIf="comprobante">Archivo: {{ comprobante.name }}</small>
              <button class="btn" type="submit" [disabled]="formulario.invalid || enviando">
                {{ enviando ? 'Enviando…' : 'Enviar para verificación' }}
              </button>
            </form>
          </div>
          <ng-template #noTransferConfigured>
            <p class="feedback warning">La administración aún no configuró los datos de transferencia. No realices el pago hasta que aparezcan aquí.</p>
          </ng-template>
        </ng-container>
        <p *ngIf="mensaje" class="feedback success" role="status">{{ mensaje }}</p>
      </ng-container>
    </section>
  `,
  styles: [`
    .advance-card { margin-top: 1.25rem; padding: 1.25rem; border: 1px solid #c9d9e2; border-radius: 18px; background: #fff; box-shadow: 0 8px 24px rgba(25, 58, 79, .08); }
    .advance-heading { display: flex; align-items: center; justify-content: space-between; gap: 1rem; }
    .eyebrow { color: #65457f; font-size: .72rem; font-weight: 700; letter-spacing: .1em; }
    h3, h4 { margin: .35rem 0 .75rem; color: #173d59; }
    .steps { display: grid; grid-template-columns: repeat(4, minmax(0, 1fr)); gap: .65rem; padding: 0; margin: 1.25rem 0; list-style: none; }
    .steps li { display: flex; gap: .65rem; align-items: flex-start; min-width: 0; padding: .8rem; border: 1px solid #dce6eb; border-radius: 12px; color: #758694; background: #f8fafb; }
    .steps li > span { display: grid; place-items: center; flex: 0 0 1.7rem; height: 1.7rem; border-radius: 50%; background: #e8edf0; font-weight: 700; }
    .steps li.done { color: #245942; border-color: #c9e0d4; background: #f3faf6; }
    .steps li.done > span { color: #fff; background: #538b6f; }
    .steps li.current { color: #533b72; border-color: #cbb9de; background: #f8f4fb; }
    .steps li.current > span { color: #fff; background: #694c86; }
    .steps strong, .steps small { display: block; }
    .steps small { margin-top: .3rem; line-height: 1.4; }
    .payment-status, .feedback { margin: .9rem 0; padding: .85rem 1rem; border-radius: 12px; }
    .payment-status p { margin: .35rem 0 0; }
    .payment-status.pending, .feedback.warning { color: #684913; background: #fff8e8; border: 1px solid #f0dfb4; }
    .payment-status.success, .feedback.success { color: #245942; background: #f1faf5; border: 1px solid #c8e2d3; }
    .feedback.error { color: #9e334f; background: #fff0f3; border: 1px solid #edcbd4; }
    .transfer-panel { display: grid; grid-template-columns: minmax(0, 1fr) minmax(260px, .9fr); gap: 1.25rem; padding: 1rem; border-radius: 14px; background: #f5f8fa; }
    dl { display: grid; gap: .5rem; }
    dl div { display: grid; grid-template-columns: 130px minmax(0, 1fr); gap: .5rem; }
    dt { color: #687b89; }
    dd { margin: 0; overflow-wrap: anywhere; font-weight: 600; color: #173d59; }
    .payment-form { display: grid; gap: .65rem; }
    label { display: grid; gap: .35rem; color: #28465d; font-weight: 600; }
    input { box-sizing: border-box; width: 100%; padding: .65rem .75rem; border: 1px solid #c8d7df; border-radius: 9px; font: inherit; background: #fff; }
    .payment-qr { display: block; width: min(180px, 100%); max-height: 180px; object-fit: contain; margin-top: .75rem; }
    @media (max-width: 760px) { .steps { grid-template-columns: 1fr 1fr; } .transfer-panel { grid-template-columns: 1fr; } }
    @media (max-width: 460px) { .steps { grid-template-columns: 1fr; } .advance-heading { align-items: flex-start; flex-direction: column; } dl div { grid-template-columns: 1fr; } }
  `],
})
export class ProcesoAnticipoComponent implements OnChanges {
  @Input() reservaId = '';
  proceso: ProcesoAnticipo | null = null;
  cargando = false;
  enviando = false;
  error = '';
  mensaje = '';
  referencia = '';
  fechaTransferencia = '';
  comprobante: File | null = null;

  constructor(private readonly http: HttpClient) {}

  ngOnChanges(changes: SimpleChanges): void {
    if (changes['reservaId'] && this.reservaId) this.cargar();
  }

  cargar(): void {
    if (!this.reservaId || this.cargando) return;
    this.cargando = true;
    this.error = '';
    this.http.get<ProcesoAnticipo>('/api/reservas/' + encodeURIComponent(this.reservaId) + '/anticipo')
      .subscribe(
        proceso => { this.proceso = proceso; this.cargando = false; },
        error => { this.cargando = false; this.error = error.error?.message || 'No se pudo cargar el proceso del anticipo.'; },
      );
  }

  seleccionarComprobante(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    const archivo = entrada.files && entrada.files[0];
    if (!archivo) { this.comprobante = null; return; }
    if (archivo.size > 5 * 1024 * 1024
        || !['application/pdf', 'image/png', 'image/jpeg'].includes(archivo.type)) {
      this.error = 'El comprobante debe ser PDF, PNG o JPG y pesar hasta 5 MB.';
      entrada.value = '';
      this.comprobante = null;
      return;
    }
    this.error = '';
    this.comprobante = archivo;
  }

  enviar(): void {
    if (!this.proceso || this.enviando || !this.referencia.trim() || !this.fechaTransferencia) return;
    const fecha = new Date(this.fechaTransferencia);
    if (!Number.isFinite(fecha.getTime())) { this.error = 'Selecciona la fecha real de la transferencia.'; return; }
    const cuerpo = new FormData();
    cuerpo.append('referencia', this.referencia.trim());
    cuerpo.append('fechaTransferencia', fecha.toISOString());
    if (this.comprobante) cuerpo.append('comprobante', this.comprobante, this.comprobante.name);
    this.enviando = true;
    this.error = '';
    this.mensaje = '';
    this.http.post<ProcesoAnticipo>(
      '/api/reservas/' + encodeURIComponent(this.reservaId) + '/anticipo/declaraciones', cuerpo,
    ).subscribe(
      proceso => {
        this.proceso = proceso;
        this.enviando = false;
        this.comprobante = null;
        this.mensaje = 'Pago reportado. La reserva se confirmará cuando administración acredite la transferencia.';
      },
      error => { this.enviando = false; this.error = error.error?.message || 'No se pudo reportar la transferencia.'; },
    );
  }

  textoEstadoAnticipo(): string {
    if (this.proceso?.declaracion?.estado === 'pendiente') return 'Pago reportado; esperando verificación administrativa.';
    if (this.proceso?.pagoAcreditado) return 'Pago acreditado y reserva habilitada.';
    if (this.proceso?.estadoReserva === 'cancelada') return 'La reserva fue cancelada.';
    if (this.proceso?.declaracion?.estado === 'rechazada') return 'Revisa el motivo y reporta el pago nuevamente.';
    return 'Realiza la transferencia y registra su referencia.';
  }

  tituloEstadoAnticipo(): string {
    if (this.proceso?.declaracion?.estado === 'pendiente') return 'Verificación pendiente';
    if (this.proceso?.declaracion?.estado === 'rechazada') return 'Necesita revisión';
    if (this.proceso?.pagoAcreditado) return 'Anticipo acreditado';
    if (this.proceso?.estadoReserva === 'cancelada') return 'Reserva cancelada';
    return 'Anticipo pendiente';
  }

  pagoAcreditadoYReservaActiva(): boolean {
    return !!this.proceso?.pagoAcreditado
      && ['reservada', 'en_ejecucion', 'finalizada'].includes(this.proceso.estadoReserva);
  }
}
