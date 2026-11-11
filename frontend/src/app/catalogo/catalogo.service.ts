import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Categoria } from './categoria';
@Injectable({ providedIn: 'root' })
export class CatalogoService {
  constructor(private readonly http: HttpClient) {}
  buscar(busqueda: string) {
    return this.http.get<Categoria[]>('/api/categorias', {
      params: new HttpParams().set('q', busqueda)
    });
  }
}
