import { Component, Input } from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { finalize } from 'rxjs/operators';
import {
  FinalizacionApiService,
  FinalizacionConfirmada,
} from './finalizacion-api.service';

@Component({
  selector: 'app-finalizacion-servicio',
  templateUrl: './finalizacion-servicio.component.html',
})
export class FinalizacionServicioComponent {
  @Input() reservaId = '';
  @Input() rol: 'trabajador' | 'cliente' | null = null;

  codigoEmitido = '';
  codigoIngresado = '';
  error = '';
  procesando = false;
  finalizacion: FinalizacionConfirmada | null = null;

  constructor(private readonly api: FinalizacionApiService) {}

  emitir(): void {
    if (!this.reservaId || this.rol !== 'trabajador' || this.procesando) {
      return;
    }

    this.error = '';
    this.procesando = true;

    this.api.emitir(this.reservaId)
      .pipe(finalize(() => { this.procesando = false; }))
      .subscribe(
        (resultado) => { this.codigoEmitido = resultado.codigo; },
        (error: HttpErrorResponse) => { this.mostrarError(error); },
      );
  }

  confirmar(): void {
    if (
      !this.reservaId ||
      this.rol !== 'cliente' ||
      this.procesando ||
      this.finalizacion
    ) {
      return;
    }

    this.error = '';
    const codigo = this.codigoIngresado.trim();

    if (!/^[A-Za-z0-9_-]{32}$/.test(codigo)) {
      this.error = 'Ingresa el código de finalización completo.';
      return;
    }

    this.procesando = true;
    this.api.confirmar(this.reservaId, codigo)
      .pipe(finalize(() => { this.procesando = false; }))
      .subscribe(
        (resultado) => {
          this.finalizacion = resultado;
          this.codigoIngresado = '';
        },
        (error: HttpErrorResponse) => { this.mostrarError(error); },
      );
  }

  private mostrarError(error: HttpErrorResponse): void {
    if (error.status === 401) {
      this.error = 'Inicia sesión para continuar.';
      return;
    }

    this.error = typeof error.error?.message === 'string'
      ? error.error.message
      : 'No se pudo completar la operación. Inténtalo de nuevo.';
  }
}