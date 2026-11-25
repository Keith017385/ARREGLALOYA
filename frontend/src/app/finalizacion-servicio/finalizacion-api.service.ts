import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export interface CodigoEmitido {
  codigoId: string;
  reservaId: string;
  codigo: string;
  generadoEn: string;
}

export interface FinalizacionConfirmada {
  id: string;
  reservaId: string;
  estado: 'finalizada';
  confirmadaEn: string;
}

@Injectable({ providedIn: 'root' })
export class FinalizacionApiService {
  constructor(private readonly http: HttpClient) {}

  iniciar(reservaId: string): Observable<{ estado: string }> {
    return this.http.post<{ estado: string }>(this.ruta(reservaId) + '/inicio', {});
  }

  emitir(reservaId: string): Observable<CodigoEmitido> {
    return this.http.post<CodigoEmitido>(
      `${this.ruta(reservaId)}/codigos`,
      {},
    );
  }

  confirmar(
    reservaId: string,
    codigo: string,
  ): Observable<FinalizacionConfirmada> {
    return this.http.post<FinalizacionConfirmada>(
      `${this.ruta(reservaId)}/confirmacion`,
      { codigo },
    );
  }

  private ruta(reservaId: string): string {
    return `/api/reservas/${encodeURIComponent(reservaId)}/finalizacion`;
  }
}