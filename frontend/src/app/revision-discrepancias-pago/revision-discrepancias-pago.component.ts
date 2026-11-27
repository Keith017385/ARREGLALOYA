import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';

interface DeclaracionDePago {
  id: string;
  solicitanteId: string;
  declaracion: string;
  importeReportado: string | null;
  solicitadaEn: string;
}

interface PagoEnDisputa {
  pagoId: string;
  reservaId: string;
  servicio: string;
  importeDeclarado: string;
  importeEsperado: string | null;
  diferencia: string | null;
  pendienteDesde: string;
  declaraciones: DeclaracionDePago[];
}

type ResultadoResolucion = 'pago_acreditado' | 'pago_no_acreditado';

interface ResolucionRegistrada {
  id: string;
  pagoId: string;
  resultado: ResultadoResolucion;
}

@Component({
  selector: 'app-revision-discrepancias-pago',
  template: `
    <h1>Discrepancias de pago</h1>

    <p *ngIf="cargando" role="status">Consultando pagos en disputa…</p>
    <p *ngIf="error" role="alert">{{ error }}</p>
    <p *ngIf="mensaje" role="status">{{ mensaje }}</p>

    <ng-container *ngIf="casos as lista">
      <p *ngIf="lista.length === 0">No hay pagos en disputa para revisar.</p>
      <p *ngIf="lista.length === 50">Se muestran los 50 casos pendientes más antiguos.</p>

      <article *ngFor="let caso of lista">
        <h2>Pago #{{ caso.pagoId }} · Reserva #{{ caso.reservaId }}</h2>
        <p>{{ caso.servicio }}</p>
        <p>Importe declarado: {{ caso.importeDeclarado | currency:'BOB':'Bs ' }}</p>
        <ng-container *ngIf="caso.importeEsperado !== null">
          <p>Importe esperado: {{ caso.importeEsperado | currency:'BOB':'Bs ' }}</p>
          <p>Diferencia (declarado menos esperado): {{ caso.diferencia | currency:'BOB':'Bs ' }}</p>
        </ng-container>
        <p>Pendiente desde {{ caso.pendienteDesde | date:'dd/MM/yyyy HH:mm':'-0400' }}</p>

        <p *ngIf="caso.declaraciones.length === 0">Diferencia detectada automáticamente.</p>
        <h3 *ngIf="caso.declaraciones.length">Declaraciones</h3>
        <ul *ngIf="caso.declaraciones.length">
          <li *ngFor="let declaracion of caso.declaraciones">
            <strong>Solicitante #{{ declaracion.solicitanteId }}</strong>
            <time [attr.datetime]="declaracion.solicitadaEn">
              {{ declaracion.solicitadaEn | date:'dd/MM/yyyy HH:mm':'-0400' }}
            </time>
            <p>{{ declaracion.declaracion }}</p>
            <p *ngIf="declaracion.importeReportado !== null">
              Importe reportado: Bs {{ declaracion.importeReportado }}
            </p>
          </li>
        </ul>
        <form (submit)="$event.preventDefault(); guardarResolucion(caso, resultado.value, motivo.value)">
          <fieldset [disabled]="pagoGuardando !== null || requiereActualizar">
            <legend>Resolver disputa</legend>
            <label>
              Resultado
              <select #resultado required>
                <option value="">Selecciona un resultado</option>
                <option value="pago_acreditado" [disabled]="!coincidenImportes(caso)">Pago acreditado</option>
                <option value="pago_no_acreditado">Pago no acreditado</option>
              </select>
            </label>
            <p *ngIf="!coincidenImportes(caso)">Solo se puede acreditar un pago que coincida con el saldo esperado.</p>
            <label>
              Motivo de la decisión
              <textarea #motivo rows="3" required maxlength="2000"></textarea>
            </label>
            <button type="submit" class="btn">
              Guardar resolución
            </button>
          </fieldset>
        </form>
        <p *ngIf="pagoGuardando === caso.pagoId" role="status">Guardando resolución…</p>
      </article>
    </ng-container>

    <button type="button" class="btn btn-outline" [disabled]="cargando || pagoGuardando !== null"
      (click)="cargar()">Actualizar bandeja</button>
  `,
  styles: [`
    article { border-bottom: 1px solid #ddd; margin-bottom: 1.25rem; padding-bottom: 1rem; }
    li { margin-bottom: 0.75rem; overflow-wrap: anywhere; }
    li p { white-space: pre-wrap; }
    time { margin-left: 0.5rem; }
    fieldset { display: grid; gap: 0.75rem; max-width: 36rem; }
    label { display: grid; gap: 0.25rem; }
    textarea, select { font: inherit; padding: 0.5rem; }
    fieldset button { justify-self: start; }
  `],
})
export class RevisionDiscrepanciasPagoComponent implements OnInit, OnDestroy {
  casos: PagoEnDisputa[] | null = null;
  cargando = false;
  error = '';
  mensaje = '';
  pagoGuardando: string | null = null;
  requiereActualizar = false;
  private consulta = Subscription.EMPTY;
  private envio = Subscription.EMPTY;

  constructor(private readonly http: HttpClient) {}

  ngOnInit(): void {
    this.cargar();
  }

  ngOnDestroy(): void {
    this.consulta.unsubscribe();
    this.envio.unsubscribe();
  }

  coincidenImportes(caso: PagoEnDisputa): boolean {
    return caso.diferencia !== null && Number(caso.diferencia) === 0;
  }

  guardarResolucion(caso: PagoEnDisputa, resultado: string, motivo: string): void {
    if (this.cargando || this.pagoGuardando !== null || this.requiereActualizar) {
      return;
    }

    if (resultado !== 'pago_acreditado' && resultado !== 'pago_no_acreditado') {
      this.error = 'Selecciona un resultado para la resolución.';
      return;
    }

    if (resultado === 'pago_acreditado' && !this.coincidenImportes(caso)) {
      this.error = 'El importe declarado debe coincidir con el saldo esperado para acreditar el pago.';
      return;
    }

    const texto = motivo.trim();
    if (!texto || Array.from(texto).length > 2000 || texto.indexOf('\0') >= 0) {
      this.error = 'Escribe un motivo válido de entre 1 y 2000 caracteres.';
      return;
    }

    this.error = '';
    this.mensaje = '';
    this.pagoGuardando = caso.pagoId;
    const ruta = `/api/administracion/discrepancias-pago/${encodeURIComponent(caso.pagoId)}/resolucion`;

    this.envio = this.http.post<ResolucionRegistrada>(ruta, { resultado, motivo: texto })
      .pipe(finalize(() => { this.pagoGuardando = null; }))
      .subscribe(
        (resolucion) => {
          this.casos = (this.casos || []).filter((fila) => fila.pagoId !== resolucion.pagoId);
          this.mensaje = `Resolución #${resolucion.id} guardada para el pago #${resolucion.pagoId}.`;
        },
        (error: HttpErrorResponse) => {
          if (error.status === 401 || error.status === 403) {
            this.casos = null;
            this.error = error.status === 401
              ? 'Inicia sesión para resolver discrepancias.'
              : 'Se requiere una cuenta de administrador activa.';
            return;
          }

          const detalle = error.error && error.error.message;
          if (error.status === 409) {
            this.requiereActualizar = true;
            this.error = typeof detalle === 'string'
              ? `${detalle} Actualiza la bandeja antes de continuar.`
              : 'El pago cambió. Actualiza la bandeja antes de continuar.';
            return;
          }

          this.error = error.status === 400 && typeof detalle === 'string'
            ? detalle
            : 'No se pudo guardar la resolución. Actualiza la bandeja para comprobar el estado.';
          if (error.status !== 400) {
            this.requiereActualizar = true;
          }
        },
      );
  }

  cargar(): void {
    if (this.cargando || this.pagoGuardando !== null) {
      return;
    }

    this.casos = null;
    this.error = '';
    this.cargando = true;

    this.consulta = this.http.get<PagoEnDisputa[]>('/api/administracion/discrepancias-pago')
      .pipe(finalize(() => { this.cargando = false; }))
      .subscribe(
        (casos) => {
          this.casos = casos;
          this.requiereActualizar = false;
        },
        (error: HttpErrorResponse) => {
          switch (error.status) {
            case 401:
              this.error = 'Inicia sesión para consultar las discrepancias de pago.';
              break;
            case 403:
              this.error = 'Se requiere una cuenta de administrador activa.';
              break;
            default:
              this.error = 'No se pudo consultar la bandeja de discrepancias.';
          }
        },
      );
  }
}
