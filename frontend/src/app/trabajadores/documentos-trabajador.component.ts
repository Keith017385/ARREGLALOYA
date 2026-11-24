import { Component, Input, OnInit } from '@angular/core';
import { DatosDocumento, DocumentoTrabajador, TIPOS_DOCUMENTO } from './documento-trabajador';
import { DocumentoTrabajadorService } from './documento-trabajador.service';

@Component({ selector: 'app-documentos-trabajador', templateUrl: './documentos-trabajador.component.html' })
export class DocumentosTrabajadorComponent implements OnInit {
  // El id del trabajador lo recibe de la pantalla "Mi perfil".
  @Input() usuarioId = '';
  tipos = TIPOS_DOCUMENTO;
  documentos: DocumentoTrabajador[] = [];
  nuevo: DatosDocumento = { tipo: '', referenciaArchivo: '' };
  cargando = false; guardando = false; error = ''; mensaje = '';
  constructor(private readonly documentosApi: DocumentoTrabajadorService) {}
  ngOnInit() { this.cargar(); }
  cargar() {
    this.cargando = true; this.error = '';
    this.documentosApi.listar(this.usuarioId).subscribe(
      datos => { this.documentos = datos; this.cargando = false; },
      () => { this.error = 'No pudimos cargar tus documentos. Vuelve a intentar.'; this.cargando = false; }
    );
  }
  presentar() {
    this.guardando = true; this.error = ''; this.mensaje = '';
    this.documentosApi.presentar(this.usuarioId, this.nuevo).subscribe(
      () => {
        this.mensaje = 'Documento presentado. Quedará pendiente hasta que lo revisen.';
        this.nuevo = { tipo: '', referenciaArchivo: '' };
        this.guardando = false;
        this.cargar();
      },
      e => { this.error = this.textoError(e, 'No pudimos presentar el documento.'); this.guardando = false; }
    );
  }
  etiquetaEstado(estado: string): string {
    if (estado === 'aprobado') { return 'Aprobado'; }
    if (estado === 'rechazado') { return 'Rechazado'; }
    if (estado === 'requiere_informacion') { return 'Requiere más información'; }
    return 'Pendiente de revisión';
  }
  etiquetaTipo(tipo: string): string {
    for (const opcion of this.tipos) {
      if (opcion.valor === tipo) { return opcion.etiqueta; }
    }
    return tipo;
  }
  private textoError(e: any, porDefecto: string): string {
    const mensaje = e && e.error && e.error.message;
    return typeof mensaje === 'string' ? mensaje : porDefecto;
  }
}