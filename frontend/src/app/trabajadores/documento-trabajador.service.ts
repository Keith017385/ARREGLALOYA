import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { DatosDocumento, DocumentoTrabajador } from './documento-trabajador';
@Injectable({ providedIn: 'root' })
export class DocumentoTrabajadorService {
  constructor(private readonly http: HttpClient) {}
  listar(usuarioId: string) {
    return this.http.get<DocumentoTrabajador[]>(`/api/trabajadores/${usuarioId}/documentos`);
  }
  presentar(usuarioId: string, datos: DatosDocumento) {
    return this.http.post<DocumentoTrabajador>(`/api/trabajadores/${usuarioId}/documentos`, datos);
  }
}