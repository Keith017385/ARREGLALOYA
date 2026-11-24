import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { CausalReclamo, DetalleReclamo, GestionReclamosApiService, ReclamoResumen } from './gestion-reclamos-api.service';

@Component({
  selector: 'app-gestion-reclamos',
  template: `
    <section aria-labelledby="reclamo-titulo">
      <h1 id="reclamo-titulo">CU-17 · Revisar reclamos formales</h1>
      <p>Analiza los antecedentes, declaraciones y operaciones vinculadas antes de registrar una resolución.</p>
      <div class="toolbar">
        <label for="reclamo-filtro">Estado</label>
        <select id="reclamo-filtro" name="estadoFiltro" [(ngModel)]="estadoFiltro" (change)="cargarLista()">
          <option value="abierto">Abiertos</option>
          <option value="en_revision">En revisión</option>
          <option value="resuelto">Resueltos</option>
          <option value="todos">Todos</option>
        </select>
        <button type="button" class="btn btn-outline" (click)="cargarLista()" [disabled]="cargando">Actualizar</button>
      </div>
      <p *ngIf="cargando" role="status">Consultando reclamos…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="mensaje" role="status">{{ mensaje }}</p>

      <div class="claim-layout">
        <div class="claim-list" *ngIf="reclamos as lista">
          <p *ngIf="lista.length === 0">No hay reclamos con el estado seleccionado.</p>
          <button type="button" class="claim-item" *ngFor="let reclamo of lista"
            [class.selected]="detalle && detalle.reclamoId === reclamo.reclamoId"
            (click)="abrir(reclamo)">
            <strong>Reclamo #{{ reclamo.reclamoId }} · Reserva #{{ reclamo.reservaId }}</strong>
            <span>{{ reclamo.reportanteNombre }} · {{ etiquetaEstado(reclamo.estado) }}</span>
            <small>{{ reclamo.presentadoEn | date:'dd/MM/yyyy HH:mm':'-0400' }}</small>
          </button>
        </div>

        <article class="claim-detail" *ngIf="detalle as caso">
          <h2>Reclamo #{{ caso.reclamoId }}</h2>
          <p><strong>Reportante:</strong> {{ caso.reportanteNombre }} ({{ caso.reportanteId }})</p>
          <p><strong>Cliente:</strong> {{ caso.clienteNombre }} · <strong>Trabajador:</strong> {{ caso.trabajadorNombre }}</p>
          <p><strong>Reserva:</strong> #{{ caso.reservaId }} · {{ caso.reservaEstado }} · Inicio {{ caso.inicioProgramado | date:'dd/MM/yyyy HH:mm':'-0400' }}</p>
          <p><strong>Presentado:</strong> {{ caso.presentadoEn | date:'dd/MM/yyyy HH:mm':'-0400' }}</p>
          <h3>Descripción del reclamo</h3>
          <p class="long-text">{{ caso.descripcion }}</p>

          <div class="actions" *ngIf="caso.estado !== 'resuelto'">
            <button class="btn btn-outline" type="button" (click)="iniciarRevision()" [disabled]="guardando || caso.estado === 'en_revision'">
              Iniciar revisión
            </button>
          </div>

          <h3>Declaraciones de asistencia</h3>
          <p *ngIf="caso.declaraciones.length === 0">No hay declaraciones de asistencia asociadas.</p>
          <ul *ngIf="caso.declaraciones.length">
            <li *ngFor="let declaracion of caso.declaraciones">
              {{ declaracion.declaradaEn | date:'dd/MM/yyyy HH:mm':'-0400' }} ·
              {{ declaracion.respuesta || 'Sin respuesta' }}
              <span *ngIf="declaracion.respondidaEn"> ({{ declaracion.respondidaEn | date:'dd/MM/yyyy HH:mm':'-0400' }})</span>
            </li>
          </ul>

          <h3>Cancelaciones registradas</h3>
          <p *ngIf="caso.cancelaciones.length === 0">No existen cancelaciones registradas para esta reserva.</p>
          <ul *ngIf="caso.cancelaciones.length">
            <li *ngFor="let cancelacion of caso.cancelaciones">
              {{ cancelacion.causalDeclarada }} · {{ cancelacion.motivo }} ·
              {{ cancelacion.solicitadaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}
            </li>
          </ul>

          <h3>Operaciones financieras de la reserva</h3>
          <p *ngIf="caso.operaciones.length === 0">No se encontraron solicitudes financieras vinculadas a esta reserva.</p>
          <article class="operation" *ngFor="let operacion of caso.operaciones">
            <div>
              <strong>#{{ operacion.solicitudFinancieraId }} · {{ operacion.tipo }}</strong>
              <p>Solicitante: {{ operacion.solicitanteNombre }} · Importe: {{ operacion.importeSolicitadoCentavos / 100 | currency:'BOB':'Bs ' }}</p>
              <p>Decisión: {{ operacion.decision || 'Pendiente' }} · Compromiso abierto: {{ operacion.compromisoAbierto ? 'Sí' : 'No' }}</p>
              <p>Movimientos: <span *ngIf="!operacion.movimientos.length">Ninguno</span>
                <span *ngFor="let movimiento of operacion.movimientos">#{{ movimiento.movimientoId }} {{ movimiento.estado }} ({{ movimiento.importeEjecutadoCentavos / 100 | currency:'BOB':'Bs ' }}) </span>
              </p>
              <p *ngIf="operacion.vinculada" class="linked">Vinculada al reclamo: los movimientos asociados permanecen bloqueados mientras el reclamo esté en revisión.</p>
            </div>
            <button *ngIf="!operacion.vinculada && caso.estado !== 'resuelto'" type="button" class="btn btn-outline"
              (click)="vincular(operacion.solicitudFinancieraId)" [disabled]="guardando">Vincular al reclamo</button>
          </article>

          <div *ngIf="caso.decision as decisionAnterior" class="decision-box">
            <h3>Resolución registrada</h3>
            <p>{{ decisionAnterior.causal }} · {{ decisionAnterior.resolucion }}</p>
            <small>{{ decisionAnterior.responsableNombre }} · {{ decisionAnterior.decididaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}</small>
          </div>

          <form *ngIf="caso.estado !== 'resuelto'" class="resolution-form" (ngSubmit)="resolver()">
            <h3>Registrar resolución administrativa</h3>
            <label for="reclamo-causal">Causal determinada</label>
            <select id="reclamo-causal" name="causal" [(ngModel)]="causal">
              <option value="cliente_anticipada">Cliente: cancelación anticipada</option>
              <option value="cliente_tardia">Cliente: cancelación tardía</option>
              <option value="trabajador_cancela">Trabajador: cancela</option>
              <option value="trabajador_no_asiste">Trabajador: no asiste</option>
              <option value="cliente_no_asiste">Cliente: no asiste</option>
              <option value="fuerza_mayor">Fuerza mayor</option>
              <option value="otro">Otra causal</option>
            </select>
            <label for="reclamo-resolucion">Fundamento de la resolución</label>
            <textarea id="reclamo-resolucion" name="resolucion" [(ngModel)]="resolucion"
              rows="4" maxlength="2000" required [disabled]="guardando"></textarea>
            <button class="btn" type="submit" [disabled]="guardando || !resolucion.trim()">
              {{ guardando ? 'Registrando…' : 'Registrar resolución y cerrar reclamo' }}
            </button>
          </form>
        </article>
      </div>
      <p class="note">La revisión no ejecuta transferencias. Si una operación está vinculada al reclamo, PostgreSQL impide iniciar o completar su movimiento mientras el reclamo siga en estado “en_revision”. Al resolverlo, el movimiento podrá continuar únicamente si cuenta con autorización financiera vigente.</p>
    </section>
  `,
  styles: [`
    .toolbar,.actions{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap;margin:1rem 0}
    .claim-layout{display:grid;grid-template-columns:minmax(14rem,22rem) minmax(0,1fr);gap:1rem;align-items:start}
    .claim-list{display:grid;gap:.5rem}.claim-item{display:grid;gap:.25rem;text-align:left;padding:.8rem;border:1px solid #ccc;border-radius:8px;background:white;font:inherit;cursor:pointer}
    .claim-item.selected{border-color:#555;background:#f5f5f5}.claim-item small{color:#666}
    .claim-detail{min-width:0;border:1px solid #ddd;border-radius:10px;padding:1rem}.claim-detail h3{margin-top:1.25rem}
    .long-text,.operation{overflow-wrap:anywhere}.operation{display:flex;justify-content:space-between;gap:1rem;border-top:1px solid #ddd;padding:.8rem 0}
    .operation p{margin:.3rem 0}.linked{font-weight:600}.resolution-form{display:grid;gap:.65rem;max-width:38rem;margin-top:1.2rem}
    textarea,select{font:inherit;padding:.55rem;max-width:100%}.decision-box{padding:.8rem;border:1px solid #aaa;border-radius:8px;margin-top:1rem}.note{color:#555;max-width:70rem}
    @media(max-width:850px){.claim-layout{grid-template-columns:1fr}.operation{flex-direction:column}}
  `],
})
export class GestionReclamosComponent implements OnInit, OnDestroy {
  reclamos: ReclamoResumen[] | null = null;
  detalle: DetalleReclamo | null = null;
  estadoFiltro = 'abierto';
  causal: CausalReclamo = 'otro';
  resolucion = '';
  cargando = false;
  guardando = false;
  error = '';
  mensaje = '';
  private operaciones = new Subscription();

  constructor(private readonly api: GestionReclamosApiService) {}
  ngOnInit(): void { this.cargarLista(); }
  ngOnDestroy(): void { this.operaciones.unsubscribe(); }

  cargarLista(): void {
    if (this.cargando || this.guardando) return;
    this.cargando = true; this.error = ''; this.mensaje = '';
    this.operaciones.add(this.api.listarReclamos(this.estadoFiltro)
      .pipe(finalize(() => { this.cargando = false; }))
      .subscribe(
        (reclamos) => { this.reclamos = reclamos; },
        (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      ));
  }

  abrir(reclamo: ReclamoResumen): void {
    this.detalle = null; this.error = ''; this.mensaje = '';
    this.operaciones.add(this.api.consultarReclamo(reclamo.reclamoId)
      .subscribe(
        (detalle) => { this.detalle = detalle; this.resolucion = ''; this.causal = 'otro'; },
        (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      ));
  }

  iniciarRevision(): void {
    const caso = this.detalle;
    if (!caso || this.guardando || caso.estado === 'resuelto') return;
    this.ejecutar(this.api.iniciarRevisionReclamo(caso.reclamoId), 'El reclamo está en revisión.');
  }

  vincular(solicitudId: string): void {
    const caso = this.detalle;
    if (!caso || this.guardando || caso.estado === 'resuelto') return;
    this.ejecutar(
      this.api.vincularOperacion(caso.reclamoId, solicitudId),
      `La operación financiera #${solicitudId} quedó vinculada y protegida por la revisión.`,
    );
  }

  resolver(): void {
    const caso = this.detalle;
    const resolucion = this.resolucion.trim();
    if (!caso || !resolucion || this.guardando || caso.estado === 'resuelto') return;
    this.ejecutar(
      this.api.resolverReclamo(caso.reclamoId, this.causal, resolucion),
      `El reclamo #${caso.reclamoId} fue resuelto.`,
    );
  }

  etiquetaEstado(estado: string): string {
    if (estado === 'en_revision') return 'En revisión';
    if (estado === 'resuelto') return 'Resuelto';
    return 'Abierto';
  }

  private ejecutar(observable: any, mensaje: string): void {
    this.guardando = true; this.error = ''; this.mensaje = '';
    this.operaciones.add(observable.pipe(finalize(() => { this.guardando = false; }))
      .subscribe(
        () => {
          this.guardando = false;
          this.mensaje = mensaje;
          this.cargarLista();
          if (this.detalle) {
            const id = this.detalle.reclamoId;
            this.operaciones.add(this.api.consultarReclamo(id).subscribe(
              (detalle) => { this.detalle = detalle; },
              (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
            ));
          }
        },
        (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      ));
  }

  private mensajeError(error: HttpErrorResponse): string {
    if (error.status === 401) return 'Inicia sesión para acceder a las funciones administrativas.';
    if (error.status === 403) return 'Tu cuenta no tiene permisos de administrador.';
    const detalle = error.error && error.error.message;
    return typeof detalle === 'string' ? detalle : 'No se pudo completar la gestión del reclamo.';
  }
}
