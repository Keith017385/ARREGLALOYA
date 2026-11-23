import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export interface ReclamoRegistrado {
  id: string;
  reservaId: string;
  descripcion: string;
  estado: 'abierto' | 'en_revision' | 'resuelto';
  presentadoEn: string;
}

@Injectable({ providedIn: 'root' })
export class ReclamoFormalApiService {
  constructor(private readonly http: HttpClient) {}

  consultar(reservaId: string) {
    return this.http.get<ReclamoRegistrado[]>(this.ruta(reservaId));
  }

  presentar(reservaId: string, descripcion: string) {
    return this.http.post<ReclamoRegistrado>(this.ruta(reservaId), { descripcion });
  }

  private ruta(reservaId: string): string {
    return `/api/reservas/${encodeURIComponent(reservaId)}/reclamos`;
  }
}