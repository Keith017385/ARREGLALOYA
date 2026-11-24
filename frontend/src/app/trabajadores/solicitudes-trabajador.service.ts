
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { SolicitudDisponible } from './solicitudes-trabajador';

@Injectable({
  providedIn: 'root'
})
export class SolicitudesTrabajadorService {

  private readonly apiUrl = '/api/trabajadores';

  constructor(private http: HttpClient) {}

  listar(usuarioId: string): Observable<SolicitudDisponible[]> {
    return this.http.get<SolicitudDisponible[]>(
      `${this.apiUrl}/${usuarioId}/solicitudes`
    );
  }
}
