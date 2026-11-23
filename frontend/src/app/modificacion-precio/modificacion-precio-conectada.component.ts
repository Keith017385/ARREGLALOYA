import { Component, Input } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { ModificacionPrecioApiService, PropuestaPrecioGuardada, ResultadoDecisionPrecio } from './modificacion-precio-api.service';

@Component({
  selector: 'app-modificacion-precio-conectada',
  template: `
    <section class="empty-state" *ngIf="reservaId">
      <h2>CU-06 · Modificación del precio</h2>
      <p>Trabajador: proponer un cambio mientras el servicio está en ejecución.</p>
      <form (ngSubmit)="proponer()">
        <label for="variacion-real">Variación en bolivianos</label>
        <input id="variacion-real" type="text" name="variacion" [(ngModel)]="importe" placeholder="10.00 o -5.50">
        <label for="motivo-real">Motivo del cambio</label>
        <textarea id="motivo-real" name="motivo" [(ngModel)]="motivo"></textarea>
        <button type="submit" [disabled]="procesando">Enviar propuesta</button>
      </form>
      <p *ngIf="propuesta">Propuesta creada con ID: {{ propuesta.id }}</p>
      <h3>Cliente: aceptar o rechazar propuesta</h3>
      <label for="id-propuesta-real">ID de la propuesta recibida</label>
      <input id="id-propuesta-real" name="propuesta" type="text" [(ngModel)]="propuestaId">
      <div>
        <button type="button" [disabled]="procesando" (click)="decidir('ACEPTADA')">Aceptar</button>
        <button type="button" [disabled]="procesando" (click)="decidir('RECHAZADA')">Rechazar</button>
      </div>
      <p *ngIf="resultado">Decisión: {{ resultado.decision }}. Precio vigente: {{ resultado.precioVigente / 100 | number:'1.2-2' }} Bs.</p>
      <p role="alert" *ngIf="error">{{ error }}</p>
    </section>
  `,
})
export class ModificacionPrecioConectadaComponent {
  @Input() reservaId = '';
  importe = '';
  motivo = '';
  propuestaId = '';
  propuesta: PropuestaPrecioGuardada | null = null;
  resultado: ResultadoDecisionPrecio | null = null;
  error = '';
  procesando = false;

  constructor(private readonly api: ModificacionPrecioApiService) {}

  proponer(): void {
    if (this.procesando) { return; }
    const texto = this.importe.trim().replace(',', '.');
    if (!/^-?\d+(?:\.\d{1,2})?$/.test(texto)) {
      this.error = 'Ingresa un importe válido de hasta dos decimales.';
      return;
    }
    const variacion = Math.round(Number(texto) * 100);
    if (!Number.isSafeInteger(variacion) || variacion === 0 || !this.motivo.trim()) {
      this.error = 'Indica una variación distinta de cero y un motivo.';
      return;
    }
    this.error = '';
    this.procesando = true;
    this.api.proponer(this.reservaId, variacion, this.motivo.trim()).subscribe(
      (respuesta) => {
        this.propuesta = respuesta;
        this.propuestaId = respuesta.id;
        this.procesando = false;
      },
      (error: HttpErrorResponse) => { this.fallo(error); },
    );
  }

  decidir(decision: 'ACEPTADA' | 'RECHAZADA'): void {
    if (this.procesando) { return; }
    if (!/^[1-9][0-9]{0,18}$/.test(this.propuestaId.trim())) {
      this.error = 'Introduce el ID válido de la propuesta.';
      return;
    }
    this.error = '';
    this.procesando = true;
    this.api.decidir(this.reservaId, this.propuestaId.trim(), decision).subscribe(
      (respuesta) => { this.resultado = respuesta; this.procesando = false; },
      (error: HttpErrorResponse) => { this.fallo(error); },
    );
  }

  private fallo(error: HttpErrorResponse): void {
    this.procesando = false;
    this.error = error.status === 401 ? 'Inicia sesión para continuar.' :
      (typeof error.error?.message === 'string' ? error.error.message : 'No se pudo completar la operación.');
  }
}
