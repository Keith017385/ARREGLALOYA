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

export interface ComplementoAnticipoPendiente {
  reservaId: string;
  precioFinal: string;
  anticipoObjetivo: string;
  anticipoRecibido: string;
  complementoPendiente: string;
}

export interface SolicitudComplementoAnticipo {
  solicitudId: string;
  importeSolicitado: string;
  reutilizada: boolean;
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
      `${this.rutaReserva(reservaId)}/modificaciones-precio`,
      { variacion: variacionCentavos, motivo },
    );
  }

  decidir(
    reservaId: string,
    propuestaId: string,
    decision: DecisionPrecio,
  ): Observable<ResultadoDecisionPrecio> {
    const propuesta = encodeURIComponent(propuestaId);
    return this.http.post<ResultadoDecisionPrecio>(
      `${this.rutaReserva(reservaId)}/modificaciones-precio/${propuesta}/decision`,
      { decision },
    );
  }

  consultarComplemento(
    reservaId: string,
  ): Observable<ComplementoAnticipoPendiente> {
    return this.http.get<ComplementoAnticipoPendiente>(
      `${this.rutaReserva(reservaId)}/complemento-anticipo`,
    );
  }

  solicitarCobroComplemento(
    reservaId: string,
  ): Observable<SolicitudComplementoAnticipo> {
    return this.http.post<SolicitudComplementoAnticipo>(
      `${this.rutaReserva(reservaId)}/complemento-anticipo/solicitudes`,
      {},
    );
  }

  private rutaReserva(reservaId: string): string {
    return `/api/reservas/${encodeURIComponent(reservaId)}`;
  }
}