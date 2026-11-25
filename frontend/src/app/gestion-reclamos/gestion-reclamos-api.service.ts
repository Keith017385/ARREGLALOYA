import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable } from '@angular/core';

export type CausalReclamo = 'cliente_anticipada' | 'cliente_tardia' | 'trabajador_cancela' | 'trabajador_no_asiste' | 'cliente_no_asiste' | 'fuerza_mayor' | 'otro';
export interface ReclamoResumen { reclamoId: string; reservaId: string; reportanteId: string; reportanteNombre: string; descripcion: string; estado: 'abierto' | 'en_revision' | 'resuelto'; presentadoEn: string; clienteId: string; clienteNombre: string; trabajadorId: string; trabajadorNombre: string; inicioProgramado: string; reservaEstado: string; operacionesVinculadas: number; }
export interface DetalleReclamo extends ReclamoResumen { declaraciones: Array<{ asistenciaId: string; declaradaEn: string; respuesta: string | null; respondidaEn: string | null }>; cancelaciones: Array<{ cancelacionId: string; actorId: string; causalDeclarada: string; motivo: string; solicitadaEn: string }>; operaciones: Array<{ solicitudFinancieraId: string; tipo: string; importeSolicitadoCentavos: number; solicitanteId: string; solicitanteNombre: string; solicitadaEn: string; decision: string | null; importeAutorizadoCentavos: number | null; compromisoAbierto: boolean; vinculada: boolean; movimientos: Array<{ movimientoId: string; estado: string; importeEjecutadoCentavos: number; iniciadoEn: string; confirmadoEn: string | null }> }>; decision: { decisionId: string; causal: CausalReclamo; resolucion: string; decididaEn: string; responsableId: string; responsableNombre: string } | null; }

@Injectable({ providedIn: 'root' })
export class GestionReclamosApiService {
  private readonly base = '/api/administracion';
  constructor(private readonly http: HttpClient) {}
  listarReclamos(estado: string) { return this.http.get<ReclamoResumen[]>(`${this.base}/reclamos`, { params: new HttpParams().set('estado', estado) }); }
  consultarReclamo(reclamoId: string) { return this.http.get<DetalleReclamo>(`${this.base}/reclamos/${encodeURIComponent(reclamoId)}`); }
  iniciarRevisionReclamo(reclamoId: string) { return this.http.post(`${this.base}/reclamos/${encodeURIComponent(reclamoId)}/revision`, {}); }
  vincularOperacion(reclamoId: string, solicitudFinancieraId: string) { return this.http.post(`${this.base}/reclamos/${encodeURIComponent(reclamoId)}/operaciones`, { solicitudFinancieraId }); }
  resolverReclamo(reclamoId: string, causal: CausalReclamo, resolucion: string) { return this.http.post(`${this.base}/reclamos/${encodeURIComponent(reclamoId)}/resolucion`, { causal, resolucion }); }
}
