import type {
  ApelacionSancion,
  DecisionApelacion,
  EvidenciaApelacionNueva,
  SancionPropia,
} from './apelacion-sancion';

export type CrearApelacionResultado =
  | { estado: 'sin_permiso' }
  | { estado: 'sancion_no_encontrada' }
  | { estado: 'sancion_no_propia' }
  | { estado: 'ya_pendiente' }
  | { estado: 'creada'; apelacion: ApelacionSancion };

export type ConsultarApelacionResultado =
  | { estado: 'sin_permiso' }
  | { estado: 'no_encontrada' }
  | { estado: 'encontrada'; apelacion: ApelacionSancion };

export type ResolverApelacionResultado =
  | { estado: 'sin_permiso' }
  | { estado: 'no_encontrada' }
  | { estado: 'ya_resuelta' }
  | { estado: 'resuelta'; apelacion: ApelacionSancion };
export interface EvidenciaApelacionDescargable {
  evidenciaId: string;
  nombreArchivo: string;
  contenido: Uint8Array;
}

export type DescargarEvidenciaApelacionResultado =
  | { estado: 'sin_permiso' }
  | { estado: 'no_encontrada' }
  | { estado: 'encontrada'; evidencia: EvidenciaApelacionDescargable };

export interface ApelacionSancionRepository {
  crear(
    actorId: string,
    sancionId: string,
    justificacion: string,
    evidencias: EvidenciaApelacionNueva[],
  ): Promise<CrearApelacionResultado>;

  listarPropias(
    actorId: string,
  ): Promise<{ estado: 'sin_permiso' } | { estado: 'listadas'; apelaciones: ApelacionSancion[] }>;

  listarPendientes(
    actorId: string,
  ): Promise<{ estado: 'sin_permiso' } | { estado: 'listadas'; apelaciones: ApelacionSancion[] }>;

  consultar(
    actorId: string,
    apelacionId: string,
  ): Promise<ConsultarApelacionResultado>;

  resolver(
    actorId: string,
    apelacionId: string,
    decision: DecisionApelacion,
    fundamento: string,
  ): Promise<ResolverApelacionResultado>;
  descargarEvidencia(
  actorId: string,
  apelacionId: string,
  evidenciaId: string,
): Promise<DescargarEvidenciaApelacionResultado>;
listarSancionesPropias(
  actorId: string,
): Promise<
  | { estado: 'sin_permiso' }
  | { estado: 'listadas'; sanciones: SancionPropia[] }
>;
}
