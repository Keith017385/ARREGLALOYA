import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription, forkJoin } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { ApelacionSancion, ApelacionSancionApiService, EvidenciaApelacion, SancionPropia } from './apelacion-sancion-api.service';

@Component({
  selector: 'app-mis-apelaciones',
  templateUrl: './mis-apelaciones.component.html',
  styleUrls: ['./apelacion-sancion.component.css'],
})
export class MisApelacionesComponent implements OnInit, OnDestroy {
  sanciones: SancionPropia[] = [];
  apelaciones: ApelacionSancion[] = [];
  sancionId = '';
  justificacion = '';
  archivos: File[] = [];
  cargando = false;
  guardando = false;
  error = '';
  mensaje = '';
  private readonly operaciones = new Subscription();

  constructor(private readonly api: ApelacionSancionApiService) {}

  ngOnInit(): void { this.cargar(); }
  ngOnDestroy(): void { this.operaciones.unsubscribe(); }

  get sancionesDisponibles(): SancionPropia[] {
    return this.sanciones.filter((sancion) => sancion.estadoApelacion !== 'pendiente');
  }

  cargar(): void {
    this.error = '';
    this.cargando = true;
    this.operaciones.add(forkJoin([
      this.api.listarSanciones(),
      this.api.listarPropias(),
    ]).pipe(finalize(() => { this.cargando = false; })).subscribe({
      next: (resultado) => {
        this.sanciones = resultado[0];
        this.apelaciones = resultado[1];
      },
      error: (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
    }));
  }

  seleccionarArchivos(evento: Event): void {
    const entrada = evento.target as HTMLInputElement;
    this.archivos = Array.from(entrada.files || []).slice(0, 3);
  }

  crear(): void {
    this.error = '';
    this.mensaje = '';
    if (!this.sancionId) {
      this.error = 'Selecciona una sanción.';
      return;
    }
    if (this.justificacion.trim().length < 20) {
      this.error = 'Explica tu apelación con al menos 20 caracteres.';
      return;
    }
    this.guardando = true;
    this.operaciones.add(this.api.crear(this.sancionId, this.justificacion.trim(), this.archivos)
      .pipe(finalize(() => { this.guardando = false; }))
      .subscribe({
        next: () => {
          this.mensaje = 'Apelación presentada. Puedes consultar aquí su estado.';
          this.sancionId = '';
          this.justificacion = '';
          this.archivos = [];
          this.cargar();
        },
        error: (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      }));
  }

  descargar(apelacion: ApelacionSancion, evidencia: EvidenciaApelacion): void {
    this.error = '';
    this.operaciones.add(this.api.descargarEvidencia(apelacion.apelacionId, evidencia.evidenciaId)
      .subscribe({
        next: (archivo) => this.guardarArchivo(archivo, evidencia.nombreArchivo),
        error: (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      }));
  }

  etiquetaEstado(estado: string): string {
    if (estado === 'pendiente') return 'En revisión';
    if (estado === 'aprobada') return 'Aprobada';
    if (estado === 'rechazada') return 'Rechazada';
    return 'Sin apelación';
  }

  private guardarArchivo(archivo: Blob, nombre: string): void {
    const url = URL.createObjectURL(archivo);
    const enlace = document.createElement('a');
    enlace.href = url;
    enlace.download = nombre.replace(/[\\/\r\n]/g, '_');
    enlace.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  }

  private mensajeError(error: HttpErrorResponse): string {
    const mensaje = error.error && error.error.message;
    return Array.isArray(mensaje) ? mensaje.join(' ') : (mensaje || 'No se pudo completar la operación.');
  }
}