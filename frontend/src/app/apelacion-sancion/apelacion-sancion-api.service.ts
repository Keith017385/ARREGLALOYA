import { HttpClient } from '@angular/common/http';
import { Injectable } from '@angular/core';

export type EstadoApelacion = 'pendiente' | 'aprobada' | 'rechazada';
export type DecisionApelacion = 'aprobada' | 'rechazada';

export interface SancionPropia {
  sancionId: string;
  motivo: string;
  inicio: string;
  fin: string;
  estadoApelacion: EstadoApelacion | null;
}

export interface EvidenciaApelacion {
  evidenciaId: string;
  nombreArchivo: string;
  cargadaEn: string;
}

export interface HistorialDecisionApelacion {
  decisionId: string;
  decision: DecisionApelacion;
  fundamento: string;
  decididaPorId: string;
  decididaEn: string;
}

export interface ApelacionSancion {
  apelacionId: string;
  sancionId: string;
  solicitadaPorId: string;
  justificacion: string;
  estado: EstadoApelacion;
  solicitadaEn: string;
  evidencias: EvidenciaApelacion[];
  historial: HistorialDecisionApelacion[];
}

@Injectable({ providedIn: 'root' })
export class ApelacionSancionApiService {
  constructor(private readonly http: HttpClient) {}

  listarSanciones() {
    return this.http.get<SancionPropia[]>('/api/trabajador/sanciones');
  }

  listarPropias() {
    return this.http.get<ApelacionSancion[]>('/api/trabajador/apelaciones');
  }

  listarPendientes() {
    return this.http.get<ApelacionSancion[]>('/api/administracion/apelaciones-sanciones');
  }

  crear(sancionId: string, justificacion: string, archivos: File[]) {
    const datos = new FormData();
    datos.append('justificacion', justificacion);
    archivos.forEach((archivo) => datos.append('evidencias', archivo, archivo.name));
    return this.http.post<ApelacionSancion>(
      '/api/trabajador/sanciones/' + encodeURIComponent(sancionId) + '/apelaciones',
      datos,
    );
  }

  resolver(apelacionId: string, decision: DecisionApelacion, fundamento: string) {
    return this.http.post<ApelacionSancion>(
      '/api/administracion/apelaciones-sanciones/' + encodeURIComponent(apelacionId) + '/decision',
      { decision, fundamento },
    );
  }

  descargarEvidencia(apelacionId: string, evidenciaId: string) {
    return this.http.get(
      '/api/apelaciones-sanciones/' + encodeURIComponent(apelacionId)
        + '/evidencias/' + encodeURIComponent(evidenciaId),
      { responseType: 'blob' },
    );
  }
}