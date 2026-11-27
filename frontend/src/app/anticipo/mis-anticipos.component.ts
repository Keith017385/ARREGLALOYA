import { HttpClient } from '@angular/common/http';
import { Component, OnInit } from '@angular/core';

interface AnticipoCliente {
  reservaId: string;
  estadoReserva: string;
  importe: string;
  pagoAcreditado: boolean;
  declaracion: null | { estado: string; solicitadaEn: string; motivoRevision: string | null };
}

@Component({
  selector: 'app-mis-anticipos',
  template: `
    <header class="page-heading">
      <div><span class="eyebrow">TUS SERVICIOS</span><h1>Mis reservas y pagos</h1>
        <p>Consulta el anticipo, las verificaciones y el avance de cada servicio.</p></div>
      <button class="btn btn-outline" type="button" (click)="cargar()" [disabled]="cargando">Actualizar</button>
    </header>
    <p *ngIf="cargando" role="status">Cargando tus reservas…</p>
    <div class="notice error" *ngIf="error" role="alert">{{ error }}</div>
    <div class="empty" *ngIf="!cargando && !error && reservas.length === 0">
      <h2>Todavía no tienes reservas</h2>
      <p>Cuando aceptes una cotización y se registre una reserva, aquí verás el importe y cada paso del anticipo.</p>
    </div>
    <article class="reservation" *ngFor="let reserva of reservas">
      <div class="reservation-heading">
        <div><span class="eyebrow">RESERVA #{{ reserva.reservaId }}</span>
          <h2>{{ nombreEstado(reserva) }}</h2>
          <p *ngIf="reserva.declaracion?.estado === 'pendiente'">Transferencia reportada; esperando revisión.</p>
          <p *ngIf="reserva.declaracion?.estado === 'rechazada'">La declaración necesita corrección.</p>
          <p *ngIf="reserva.pagoAcreditado">Anticipo acreditado.</p>
          <p *ngIf="!reserva.declaracion && !reserva.pagoAcreditado && reserva.estadoReserva === 'pendiente_anticipo'">Esperando el anticipo.</p>
        </div>
        <strong class="amount">Bs {{ reserva.importe }}</strong>
      </div>
      <button class="btn" type="button" (click)="alternar(reserva.reservaId)">
        {{ reservaAbierta === reserva.reservaId ? 'Ocultar seguimiento' : 'Ver pago y seguimiento' }}
      </button>
      <app-proceso-anticipo *ngIf="reservaAbierta === reserva.reservaId" [reservaId]="reserva.reservaId"></app-proceso-anticipo>
    </article>
  `,
  styles: [`
    .page-heading, .reservation-heading { display: flex; align-items: flex-start; justify-content: space-between; gap: 1rem; }
    .page-heading { margin-bottom: 1.25rem; }
    .eyebrow { color: #65457f; font-size: .72rem; font-weight: 700; letter-spacing: .1em; }
    h1, h2 { color: #173d59; margin: .35rem 0; }
    p { color: #536d7d; }
    .reservation, .empty { margin: 1rem 0; padding: 1.25rem; border: 1px solid #cbdbe3; border-radius: 16px; background: #fff; box-shadow: 0 6px 20px rgba(25, 58, 79, .08); }
    .amount { padding: .55rem .75rem; border-radius: 10px; color: #533b72; background: #f1ebf7; white-space: nowrap; }
    .notice { padding: .85rem 1rem; border-radius: 10px; }
    .error { color: #9e334f; background: #fff0f3; }
    @media (max-width: 580px) { .page-heading, .reservation-heading { flex-direction: column; } }
  `],
})
export class MisAnticiposComponent implements OnInit {
  reservas: AnticipoCliente[] = [];
  reservaAbierta = '';
  cargando = false;
  error = '';

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void { this.cargar(); }

  cargar(): void {
    if (this.cargando) return;
    this.cargando = true;
    this.error = '';
    this.http.get<AnticipoCliente[]>('/api/cliente/anticipos').subscribe(
      reservas => { this.reservas = reservas; this.cargando = false; },
      error => {
        this.cargando = false;
        this.error = error.status === 401 ? 'Inicia sesión para consultar tus reservas.'
          : error.error?.message || 'No se pudieron cargar tus reservas. Intenta actualizar.';
      },
    );
  }

  alternar(reservaId: string): void {
    this.reservaAbierta = this.reservaAbierta === reservaId ? '' : reservaId;
  }

  nombreEstado(reserva: AnticipoCliente): string {
    if (reserva.estadoReserva === 'cancelada') return 'Reserva cancelada';
    if (reserva.estadoReserva === 'finalizada') return 'Servicio terminado';
    if (reserva.estadoReserva === 'en_ejecucion') return 'Servicio en curso';
    if (reserva.pagoAcreditado) return 'Reserva confirmada';
    if (reserva.declaracion?.estado === 'pendiente') return 'Pago en verificación';
    if (reserva.declaracion?.estado === 'rechazada') return 'Pago por corregir';
    return 'Anticipo pendiente';
  }
}
