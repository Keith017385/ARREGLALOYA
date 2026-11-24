import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export type RespuestaAsistencia = 'confirmada' | 'rechazada';

export interface DeclaracionAsistencia {
  id: string;
  reservaId: string;
  declaradaEn: string;
  respuesta: RespuestaAsistencia | null;
  respondidaEn: string | null;
}

interface RespuestaRegistrada {
  asistenciaId: string;
  respuesta: RespuestaAsistencia;
  respondidaEn: string;
}

@Injectable({ providedIn: 'root' })
export class DeclaracionAsistenciaApiService {
  constructor(private readonly http: HttpClient) {}

  consultar(reservaId: string) {
    return this.http.get<DeclaracionAsistencia[]>(this.ruta(reservaId));
  }

  responder(reservaId: string, asistenciaId: string, respuesta: RespuestaAsistencia) {
    const ruta = `${this.ruta(reservaId)}/${encodeURIComponent(asistenciaId)}/respuesta`;
    return this.http.post<RespuestaRegistrada>(ruta, { respuesta });
  }

  private ruta(reservaId: string): string {
    return `/api/reservas/${encodeURIComponent(reservaId)}/asistencias`;
  }
}