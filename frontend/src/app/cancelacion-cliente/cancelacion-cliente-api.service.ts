import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export interface LiquidacionCancelacion {
  causal: 'cliente_anticipada' | 'cliente_tardia';
  fondoCentavos: number;
  comisionCentavos: number;
  reembolsoCentavos: number;
  compensacionTrabajadorCentavos: number;
  repartoPlataformaCentavos: number;
}

export interface VistaPreviaCancelacion extends LiquidacionCancelacion {
  inicioProgramado: string;
}

export interface CancelacionConfirmada extends LiquidacionCancelacion {
  cancelacionId: string;
  solicitudFinancieraId: string | null;
}

@Injectable({ providedIn: 'root' })
export class CancelacionClienteApiService {
  constructor(private readonly http: HttpClient) {}

  consultar(reservaId: string) {
    return this.http.get<VistaPreviaCancelacion>(`${this.ruta(reservaId)}/vista-previa`);
  }

  confirmar(reservaId: string, motivo: string, vista: VistaPreviaCancelacion) {
    const {
      causal, fondoCentavos, comisionCentavos, reembolsoCentavos,
      compensacionTrabajadorCentavos, repartoPlataformaCentavos,
    } = vista;

    return this.http.post<CancelacionConfirmada>(this.ruta(reservaId), {
      motivo,
      vistaPrevia: {
        causal, fondoCentavos, comisionCentavos, reembolsoCentavos,
        compensacionTrabajadorCentavos, repartoPlataformaCentavos,
      },
    });
  }

  private ruta(reservaId: string): string {
    return `/api/reservas/${encodeURIComponent(reservaId)}/cancelacion`;
  }
}