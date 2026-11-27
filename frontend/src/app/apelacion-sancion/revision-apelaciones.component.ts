import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ApelacionSancion, ApelacionSancionApiService, DecisionApelacion, EvidenciaApelacion } from './apelacion-sancion-api.service';

@Component({
  selector: 'app-revision-apelaciones',
  templateUrl: './revision-apelaciones.component.html',
  styleUrls: ['./apelacion-sancion.component.css'],
})
export class RevisionApelacionesComponent implements OnInit, OnDestroy {
  apelaciones: ApelacionSancion[] = [];
  fundamentos: { [apelacionId: string]: string } = {};
  cargando = false;
  error = '';
  mensaje = '';
  resolviendoId: string | null = null;
  private readonly operaciones = new Subscription();

  constructor(private readonly api: ApelacionSancionApiService) {}

  ngOnInit(): void { this.cargar(); }
  ngOnDestroy(): void { this.operaciones.unsubscribe(); }

  cargar(): void {
    this.error = '';
    this.cargando = true;
    this.operaciones.add(this.api.listarPendientes()
      .pipe(finalize(() => { this.cargando = false; }))
      .subscribe({
        next: (apelaciones) => { this.apelaciones = apelaciones; },
        error: (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      }));
  }

  resolver(apelacion: ApelacionSancion, decision: DecisionApelacion): void {
    this.error = '';
    this.mensaje = '';
    const fundamento = (this.fundamentos[apelacion.apelacionId] || '').trim();
    if (fundamento.length < 10) {
      this.error = 'Escribe un fundamento de al menos 10 caracteres.';
      return;
    }

    this.resolviendoId = apelacion.apelacionId;
    this.operaciones.add(this.api.resolver(apelacion.apelacionId, decision, fundamento)
      .pipe(finalize(() => { this.resolviendoId = null; }))
      .subscribe({
        next: () => {
          this.mensaje = 'La decisión quedó registrada en el historial.';
          delete this.fundamentos[apelacion.apelacionId];
          this.cargar();
        },
        error: (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      }));
  }

  descargar(apelacion: ApelacionSancion, evidencia: EvidenciaApelacion): void {
    this.error = '';
    this.operaciones.add(this.api.descargarEvidencia(apelacion.apelacionId, evidencia.evidenciaId)
      .subscribe({
        next: (archivo) => {
          const url = URL.createObjectURL(archivo);
          const enlace = document.createElement('a');
          enlace.href = url;
          enlace.download = evidencia.nombreArchivo.replace(/[\\/\r\n]/g, '_');
          enlace.click();
          window.setTimeout(() => URL.revokeObjectURL(url), 1000);
        },
        error: (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      }));
  }

  private mensajeError(error: HttpErrorResponse): string {
    const mensaje = error.error && error.error.message;
    return Array.isArray(mensaje) ? mensaje.join(' ') : (mensaje || 'No se pudo completar la operación.');
  }
}