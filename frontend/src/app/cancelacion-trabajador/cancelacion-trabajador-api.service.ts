import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export interface VistaPreviaCancelacionTrabajador {
  reservaId: string;
  estado: string;
  inicioProgramado: string;
  reembolsoCentavos: number;
  desembolsosPreviosCentavos: number;
}

export interface CancelacionTrabajadorConfirmada {
  reservaId: string;
  cancelacionId: string;
  incidenteId: string;
  solicitudFinancieraId: string | null;
  estadoAnterior: string;
  estadoNuevo: 'cancelada';
  reembolsoCentavos: number;
  desembolsosPreviosCentavos: number;
}

@Injectable({ providedIn: 'root' })
export class CancelacionTrabajadorApiService {
  constructor(private readonly http: HttpClient) {}

  consultar(reservaId: string) {
    return this.http.get<VistaPreviaCancelacionTrabajador>(
      `${this.ruta(reservaId)}/vista-previa`,
    );
  }

  confirmar(
    reservaId: string,
    motivo: string,
    vistaPrevia: VistaPreviaCancelacionTrabajador,
  ) {
    return this.http.post<CancelacionTrabajadorConfirmada>(this.ruta(reservaId), {
      motivo,
      vistaPrevia,
    });
  }

  private ruta(reservaId: string): string {
    return `/api/trabajador/reservas/${encodeURIComponent(reservaId)}/cancelacion`;
  }
}
