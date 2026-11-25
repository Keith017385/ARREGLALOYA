import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CuentaTrabajador } from './cuenta-trabajador';

@Injectable({ providedIn: 'root' })
export class CuentaTrabajadorService {
  constructor(private readonly http: HttpClient) {}

  obtener(usuarioId: string): Observable<CuentaTrabajador> {
    return this.http.get<CuentaTrabajador>(`/api/trabajadores/${usuarioId}/cuenta`);
  }

  suspender(usuarioId: string): Observable<CuentaTrabajador> {
    return this.http.post<CuentaTrabajador>(`/api/trabajadores/${usuarioId}/cuenta/suspension`, {});
  }

  reactivar(usuarioId: string): Observable<CuentaTrabajador> {
    return this.http.post<CuentaTrabajador>(`/api/trabajadores/${usuarioId}/cuenta/reactivacion`, {});
  }
}