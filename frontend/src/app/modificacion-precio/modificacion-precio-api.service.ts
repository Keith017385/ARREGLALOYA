import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';
import { Observable } from 'rxjs';

export type DecisionPrecio = 'ACEPTADA' | 'RECHAZADA';

export interface PropuestaPrecioGuardada {
  id: string;
  reservaId: string;
  variacion: number;
  motivo: string;
  proponenteId: string;
  propuestaEn: string;
  decisionRegistrada: null;
}

export interface AjustePrecio {
  anticipoObjetivo: number;
  comisionObjetivo: number;
  complementoAnticipo: number;
  saldoPendiente: number;
  excesoPagado: number;
}

export interface ResultadoDecisionPrecio {
  propuestaId: string;
  decision: DecisionPrecio;
  precioVigente: number;
  ajuste: AjustePrecio | null;
}

@Injectable({ providedIn: 'root' })
export class ModificacionPrecioApiService {
  constructor(private readonly http: HttpClient) {}

  proponer(
    reservaId: string,
    variacionCentavos: number,
    motivo: string,
  ): Observable<PropuestaPrecioGuardada> {
    return this.http.post<PropuestaPrecioGuardada>(
      this.rutaReserva(reservaId),
      {
        variacion: variacionCentavos,
        motivo,
      },
    );
  }

  decidir(
    reservaId: string,
    propuestaId: string,
    decision: DecisionPrecio,
  ): Observable<ResultadoDecisionPrecio> {
    return this.http.post<ResultadoDecisionPrecio>(
      `${this.rutaReserva(reservaId)}/${encodeURIComponent(propuestaId)}/decision`,
      { decision },
    );
  }

  private rutaReserva(reservaId: string): string {
    return `/api/reservas/${encodeURIComponent(reservaId)}/modificaciones-precio`;
  }
}