import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export interface PagoDirecto {
  id: string;
  reservaId: string;
  importeCentavos: number;
  declaradoEn: string;
  confirmadoEn: string | null;
}

export interface EstadoPagoFinal {
  reservaId: string;
  estadoReserva: string;
  rol: 'cliente' | 'trabajador';
  saldoCentavos: number;
  puedeRegistrarPago: boolean;
  plazoRevisionVigente: boolean;
  pagoRegistrado: PagoDirecto | null;
  enRevision: boolean;
  yaSolicitoRevision: boolean;
}

@Injectable({ providedIn: 'root' })
export class PagoFinalApiService {
  constructor(private readonly http: HttpClient) {}

  consultarEstado(reservaId: string) {
    return this.http.get<EstadoPagoFinal>(this.ruta(reservaId));
  }

  declarar(reservaId: string, importeCentavos: number) {
    return this.http.post<PagoDirecto>(this.ruta(reservaId), { importeCentavos });
  }

  confirmar(reservaId: string, pagoId: string) {
    const ruta = `${this.ruta(reservaId)}/${encodeURIComponent(pagoId)}/confirmacion`;
    return this.http.post<PagoDirecto>(ruta, {});
  }

  solicitarRevision(
    reservaId: string,
    pagoId: string,
    declaracion: string,
    importeCentavos: number | null,
  ) {
    const ruta = `${this.ruta(reservaId)}/${encodeURIComponent(pagoId)}/discrepancias`;
    return this.http.post<{ id: string; pagoId: string; solicitadaEn: string }>(
      ruta,
      { declaracion, importeCentavos },
    );
  }

  private ruta(reservaId: string): string {
    return `/api/reservas/${encodeURIComponent(reservaId)}/pagos-directos`;
  }
}
