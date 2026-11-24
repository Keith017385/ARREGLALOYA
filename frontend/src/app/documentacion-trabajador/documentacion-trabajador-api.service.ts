import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

export type ResultadoDocumento = 'aprobado' | 'rechazado' | 'requiere_informacion';
export interface DocumentoTrabajador { documentoId: string; trabajadorId: string; trabajadorNombre: string; tipo: string; referenciaArchivo: string; presentadoEn: string; resultado: ResultadoDocumento | null; motivoRevision: string | null; revisadoEn: string | null; revisorNombre: string | null; }

@Injectable({ providedIn: 'root' })
export class DocumentacionTrabajadorApiService {
  private readonly base = '/api/administracion';
  constructor(private readonly http: HttpClient) {}
  listarDocumentos(estado: string) { return this.http.get<DocumentoTrabajador[]>(`${this.base}/documentacion-trabajadores`, { params: new HttpParams().set('estado', estado) }); }
  revisarDocumento(documentoId: string, resultado: ResultadoDocumento, motivo: string) { return this.http.post(`${this.base}/documentacion-trabajadores/${encodeURIComponent(documentoId)}/revision`, { resultado, motivo }); }
}
