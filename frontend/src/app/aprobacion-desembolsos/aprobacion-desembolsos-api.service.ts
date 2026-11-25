import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export interface SolicitudDesembolso { solicitudFinancieraId: string; reservaId: string; trabajadorId: string; trabajadorNombre: string; clienteNombre: string; importeSolicitadoCentavos: number; disponibleCentavos: number; solicitadaEn: string; reservaEstado: string; reclamoEnRevision: boolean; documentosDisponibles: false; }

@Injectable({ providedIn: 'root' })
export class AprobacionDesembolsosApiService {
  private readonly base = '/api/administracion';
  constructor(private readonly http: HttpClient) {}
  listarDesembolsos() { return this.http.get<SolicitudDesembolso[]>(`${this.base}/desembolsos`); }
  decidirDesembolso(solicitudId: string, decision: 'aprobada' | 'rechazada', importeAutorizadoCentavos: number | null, motivo: string) { return this.http.post(`${this.base}/desembolsos/${encodeURIComponent(solicitudId)}/decision`, { decision, importeAutorizadoCentavos, motivo }); }
}
