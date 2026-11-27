import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { CasoAbierto, DatosDictamen } from './dictamen-asistencia';

@Injectable({ providedIn: 'root' })
export class DictamenAsistenciaService {
  constructor(private readonly http: HttpClient) {}

  listar(): Observable<CasoAbierto[]> {
    return this.http.get<CasoAbierto[]>('/api/superadministracion/dictamenes-asistencia');
  }

  dictaminar(respuestaId: string, datos: DatosDictamen): Observable<any> {
    return this.http.post(`/api/superadministracion/dictamenes-asistencia/${respuestaId}`, datos);
  }
}