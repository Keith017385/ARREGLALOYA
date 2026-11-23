import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export interface CalificacionRegistrada {
  id: string;
  reservaId: string;
  version: number;
  puntuacion: number;
  opinion: string | null;
  registradaEn: string;
}

@Injectable({ providedIn: 'root' })
export class CalificacionOpinionApiService {
  constructor(private readonly http: HttpClient) {}

  registrar(reservaId: string, puntuacion: number, opinion: string | null) {
    return this.http.post<CalificacionRegistrada>(
      `/api/reservas/${encodeURIComponent(reservaId)}/calificaciones`,
      { puntuacion, opinion },
    );
  }
}
