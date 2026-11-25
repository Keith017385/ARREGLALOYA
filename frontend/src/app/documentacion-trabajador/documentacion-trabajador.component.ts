import { HttpErrorResponse } from '@angular/common/http';
import { Component, OnDestroy, OnInit } from '@angular/core';
import { Subscription } from 'rxjs';
import { finalize } from 'rxjs/operators';
import { DocumentoTrabajador, DocumentacionTrabajadorApiService, ResultadoDocumento } from './documentacion-trabajador-api.service';

@Component({
  selector: 'app-documentacion-trabajador',
  template: `
    <section aria-labelledby="documentacion-titulo">
      <h1 id="documentacion-titulo">CU-16 · Revisar documentación de trabajadores</h1>
      <p>Consulta los documentos presentados y registra el resultado de cada revisión.</p>
      <div class="toolbar">
        <label for="documentacion-filtro">Estado</label>
        <select id="documentacion-filtro" name="estadoFiltro" [(ngModel)]="estadoFiltro" (change)="cargar()">
          <option value="pendiente">Pendientes</option>
          <option value="aprobado">Aprobados</option>
          <option value="requiere_informacion">Requieren información</option>
          <option value="rechazado">Rechazados</option>
          <option value="todos">Todos</option>
        </select>
        <button class="btn btn-outline" type="button" (click)="cargar()" [disabled]="cargando">Actualizar</button>
      </div>
      <p *ngIf="cargando" role="status">Consultando documentación…</p>
      <p *ngIf="error" role="alert">{{ error }}</p>
      <p *ngIf="mensaje" role="status">{{ mensaje }}</p>

      <div class="document-list" *ngIf="documentos as lista">
        <p *ngIf="lista.length === 0">No hay documentos para el filtro seleccionado.</p>
        <article class="document-card" *ngFor="let documento of lista">
          <div>
            <strong>Documento #{{ documento.documentoId }} · {{ documento.tipo }}</strong>
            <p>{{ documento.trabajadorNombre }} · ID trabajador {{ documento.trabajadorId }}</p>
            <p>Presentado: {{ documento.presentadoEn | date:'dd/MM/yyyy HH:mm':'-0400' }}</p>
            <p>Referencia del archivo: <code>{{ documento.referenciaArchivo }}</code></p>
            <p>Estado: <strong>{{ etiqueta(documento.resultado) }}</strong></p>
            <p *ngIf="documento.motivoRevision">Última observación: {{ documento.motivoRevision }}</p>
            <p *ngIf="documento.revisadoEn">Revisado: {{ documento.revisadoEn | date:'dd/MM/yyyy HH:mm':'-0400' }} · {{ documento.revisorNombre || 'Administrador' }}</p>
          </div>
          <button type="button" class="btn btn-outline" (click)="seleccionar(documento)" [disabled]="guardando">Revisar</button>
        </article>
      </div>

      <form *ngIf="seleccionado as documento" class="review-form" (ngSubmit)="guardar()">
        <h2>Revisión del documento #{{ documento.documentoId }}</h2>
        <label for="documentacion-resultado">Resultado</label>
        <select id="documentacion-resultado" name="resultado" [(ngModel)]="resultado">
          <option value="aprobado">Aprobado</option>
          <option value="requiere_informacion">Requiere información</option>
          <option value="rechazado">Rechazado</option>
        </select>
        <label for="documentacion-motivo">Motivo o fundamento (obligatorio)</label>
        <textarea id="documentacion-motivo" name="motivo" rows="3" maxlength="2000"
          [(ngModel)]="motivo" required [disabled]="guardando"></textarea>
        <div class="actions">
          <button class="btn" type="submit" [disabled]="guardando || !motivo.trim()">
            {{ guardando ? 'Guardando…' : 'Registrar revisión' }}
          </button>
          <button class="btn btn-outline" type="button" (click)="cancelarSeleccion()" [disabled]="guardando">Cancelar</button>
        </div>
      </form>
      <p class="note">La opción “Requiere información” registra el resultado de revisión. La carga de documentos corregidos depende del flujo de presentación documental del trabajador.</p>
    </section>
  `,
  styles: [`
    .toolbar,.actions{display:flex;gap:.7rem;align-items:center;flex-wrap:wrap;margin:1rem 0}
    .document-list{display:grid;gap:.8rem;max-width:60rem}
    .document-card{display:flex;justify-content:space-between;gap:1rem;align-items:center;border:1px solid #ddd;border-radius:10px;padding:1rem}
    .document-card p{margin:.35rem 0;overflow-wrap:anywhere}
    .review-form{display:grid;gap:.65rem;max-width:38rem;margin:1.2rem 0;padding:1rem;border:1px solid #bbb;border-radius:10px}
    textarea,select{font:inherit;padding:.55rem;max-width:100%} .note{color:#555;max-width:60rem}
  `],
})
export class DocumentacionTrabajadorComponent implements OnInit, OnDestroy {
  documentos: DocumentoTrabajador[] | null = null;
  seleccionado: DocumentoTrabajador | null = null;
  estadoFiltro = 'pendiente';
  resultado: ResultadoDocumento = 'aprobado';
  motivo = '';
  cargando = false;
  guardando = false;
  error = '';
  mensaje = '';
  private operaciones = new Subscription();

  constructor(private readonly api: DocumentacionTrabajadorApiService) {}

  ngOnInit(): void { this.cargar(); }
  ngOnDestroy(): void { this.operaciones.unsubscribe(); }

  cargar(): void {
    if (this.cargando || this.guardando) return;
    this.error = ''; this.mensaje = ''; this.cargando = true;
    this.operaciones.add(this.api.listarDocumentos(this.estadoFiltro)
      .pipe(finalize(() => { this.cargando = false; }))
      .subscribe(
        (documentos) => { this.documentos = documentos; },
        (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      ));
  }

  seleccionar(documento: DocumentoTrabajador): void {
    this.seleccionado = documento;
    this.resultado = 'aprobado';
    this.motivo = '';
    this.error = '';
    this.mensaje = '';
  }

  cancelarSeleccion(): void { this.seleccionado = null; this.motivo = ''; }

  guardar(): void {
    const documento = this.seleccionado;
    const motivo = this.motivo.trim();
    if (!documento || !motivo || this.guardando) return;
    this.guardando = true; this.error = ''; this.mensaje = '';
    this.operaciones.add(this.api.revisarDocumento(documento.documentoId, this.resultado, motivo)
      .pipe(finalize(() => { this.guardando = false; }))
      .subscribe(
        () => {
          this.guardando = false;
          this.mensaje = `La revisión del documento #${documento.documentoId} fue registrada.`;
          this.seleccionado = null; this.motivo = ''; this.cargar();
        },
        (error: HttpErrorResponse) => { this.error = this.mensajeError(error); },
      ));
  }

  etiqueta(resultado: string | null): string {
    if (!resultado) return 'Pendiente';
    if (resultado === 'requiere_informacion') return 'Requiere información';
    return resultado === 'aprobado' ? 'Aprobado' : 'Rechazado';
  }

  private mensajeError(error: HttpErrorResponse): string {
    if (error.status === 401) return 'Inicia sesión para acceder a las funciones administrativas.';
    if (error.status === 403) return 'Tu cuenta no tiene permisos de administrador.';
    const detalle = error.error && error.error.message;
    return typeof detalle === 'string' ? detalle : 'No se pudo completar la revisión documental.';
  }
}
