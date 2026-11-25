
import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { OfertaTrabajador, SolicitudDisponible } from './solicitudes-trabajador';

@Injectable({
  providedIn: 'root'
})
export class SolicitudesTrabajadorService {

  private readonly apiUrl = '/api/trabajadores';

  constructor(private http: HttpClient) {}

  ofertas(usuarioId: string): Observable<OfertaTrabajador[]> {
    return this.http.get<OfertaTrabajador[]>(this.apiUrl + '/' + usuarioId + '/ofertas');
  }

  enviar(usuarioId: string, operacion: string, datos: object): Observable<unknown> {
    return this.http.post(this.apiUrl + '/' + usuarioId + '/' + operacion, datos);
  }

  listar(usuarioId: string): Observable<SolicitudDisponible[]> {
    return this.http.get<SolicitudDisponible[]>(
      `${this.apiUrl}/${usuarioId}/solicitudes`
    );
  }
}
