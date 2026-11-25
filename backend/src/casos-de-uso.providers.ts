/**
 * COMPOSICION DE DEPENDENCIAS (DIP de SOLID)
 *
 * Controller -> Service -> contrato CORE <- Repository PostgreSQL.
 * Solo esta configuracion conoce las implementaciones concretas.
 * Todos los repositorios reciben el MISMO pool de DbService.
 */
import type { Provider, Type } from '@nestjs/common';
import type { Pool } from 'pg';

import { DbService } from './INFRASTRUCTURE/db.service';
import { CategoriasRepository } from './CORE/categoria';
import { PostgresCategoriasRepository } from './INFRASTRUCTURE/postgres-categorias.repository';
import { CategoriasService } from './SERVICE/categorias.service';

import { CalificacionOpinionService } from './SERVICE/calificacion-opinion/calificacion-opinion.service';
import { PostgresCalificacionOpinionRepository } from './INFRASTRUCTURE/calificacion-opinion/postgres-calificacion-opinion.repository';
import { ReclamoFormalService } from './SERVICE/reclamo-formal/reclamo-formal.service';
import { PostgresReclamoFormalRepository } from './INFRASTRUCTURE/reclamo-formal/postgres-reclamo-formal.repository';
import { DeclaracionAsistenciaService } from './SERVICE/declaracion-asistencia/declaracion-asistencia.service';
import { PostgresDeclaracionAsistenciaRepository } from './INFRASTRUCTURE/declaracion-asistencia/postgres-declaracion-asistencia.repository';
import { CancelacionClienteService } from './SERVICE/cancelacion-cliente/cancelacion-cliente.service';
import { PostgresCancelacionClienteRepository } from './INFRASTRUCTURE/cancelacion-cliente/postgres-cancelacion-cliente.repository';
import { RevisionDiscrepanciasPagoService } from './SERVICE/revision-discrepancias-pago/revision-discrepancias-pago.service';
import { PostgresRevisionDiscrepanciasPagoRepository } from './INFRASTRUCTURE/revision-discrepancias-pago/postgres-revision-discrepancias-pago.repository';
import { IncidentesSancionesService } from './SERVICE/incidentes-sanciones/incidentes-sanciones.service';
import { PostgresIncidentesSancionesRepository } from './INFRASTRUCTURE/incidentes-sanciones/postgres-incidentes-sanciones.repository';
import { GestionRevisionAsistenciaService } from './SERVICE/casos-escalados/gestion-revision-asistencia.service';
import { PostgresGestionRevisionAsistenciaRepository } from './INFRASTRUCTURE/casos-escalados/postgres-gestion-revision-asistencia.repository';
import { PostgresCandidatosAsistenciaRepository } from './INFRASTRUCTURE/casos-escalados/postgres-candidatos-asistencia.repository';
import { RespuestaOpinionService } from './SERVICE/respuesta-opinion/respuesta-opinion.service';
import { PostgresRespuestaOpinionRepository } from './INFRASTRUCTURE/respuesta-opinion/postgres-respuesta-opinion.repository';

import { PostgresModificacionPrecioRepository } from './INFRASTRUCTURE/postgres-modificacion-precio.repository';
import { ModificacionPrecioService } from './SERVICE/modificacion-precio.service';
import { PostgresComplementoAnticipoRepository } from './INFRASTRUCTURE/postgres-complemento-anticipo.repository';
import { PostgresInicioComplementoAnticipoRepository } from './INFRASTRUCTURE/postgres-inicio-complemento-anticipo.repository';
import { ComplementoAnticipoService } from './SERVICE/complemento-anticipo.service';
import { CandidatosAsistenciaService } from './SERVICE/casos-escalados/candidatos-asistencia.service';

import { PostgresUsuariosRepository } from './INFRASTRUCTURE/postgres-usuarios.repository';
import { UsuariosService } from '././SERVICE/usuarios.service';
import { UsuariosRepository } from './CORE/usuarios/usuarios.repository';
import { AutenticacionService } from './SERVICE/usuarios/autenticacion.service';

import { PerfilTrabajadorService } from './SERVICE/perfil-trabajador.service';
import { PostgresPerfilTrabajadorRepository } from './INFRASTRUCTURE/postgres-perfil-trabajador.repository';
import { PerfilTrabajadorRepository } from './CORE/perfil-trabajador';
import { DocumentoVerificacionService } from './SERVICE/documento-verificacion.service';
import { PostgresDocumentoVerificacionRepository } from './INFRASTRUCTURE/postgres-documento-verificacion.repository';
import { DocumentoVerificacionRepository } from './CORE/documento-verificacion';
import { SolicitudDisponibleService } from './SERVICE/solicitud-disponible.service';
import { PostgresSolicitudDisponibleRepository } from './INFRASTRUCTURE/postgres-solicitud-disponible.repository';
import { CuentaTrabajadorService } from './SERVICE/cuenta-trabajador.service';
import { PostgresCuentaTrabajadorRepository } from './INFRASTRUCTURE/postgres-cuenta-trabajador.repository';
import { CuentaTrabajadorRepository } from './CORE/cuenta-trabajador';
import { CancelacionTrabajadorService } from './SERVICE/cancelacion-trabajador/cancelacion-trabajador.service';
import { PostgresCancelacionTrabajadorRepository } from './INFRASTRUCTURE/cancelacion-trabajador/postgres-cancelacion-trabajador.repository';
import { DocumentacionTrabajadorService } from './SERVICE/documentacion-trabajador/documentacion-trabajador.service';
import { PostgresDocumentacionTrabajadorRepository } from './INFRASTRUCTURE/documentacion-trabajador/postgres-documentacion-trabajador.repository';
import { GestionReclamosService } from './SERVICE/gestion-reclamos/gestion-reclamos.service';
import { PostgresGestionReclamosRepository } from './INFRASTRUCTURE/gestion-reclamos/postgres-gestion-reclamos.repository';
import { AprobacionDesembolsosService } from './SERVICE/aprobacion-desembolsos/aprobacion-desembolsos.service';
import { PostgresAprobacionDesembolsosRepository } from './INFRASTRUCTURE/aprobacion-desembolsos/postgres-aprobacion-desembolsos.repository';

import { SolicitudesRepository } from './CORE/solicitudes';
import { SolicitudesService } from './SERVICE/solicitudes.service';
import { PostgresSolicitudesRepository } from './INFRASTRUCTURE/postgres-solicitudes.repository';

import { CotizacionesRepository } from './CORE/cotizaciones';
import { CotizacionesService } from './SERVICE/cotizaciones.service';
import { PostgresCotizacionesRepository } from './INFRASTRUCTURE/postgres-cotizaciones.repository';

import { ReservaInicialRepository } from './CORE/reserva-inicial';
import { ReservaInicialService } from './SERVICE/reserva-inicial.service';
import { PostgresReservaInicialRepository } from './INFRASTRUCTURE/postgres-reserva-inicial.repository';

import { SeleccionTrabajadorRepository } from './CORE/seleccion-trabajador';
import { SeleccionTrabajadorService } from './SERVICE/seleccion-trabajador.service';
import { PostgresSeleccionTrabajadorRepository } from './INFRASTRUCTURE/postgres-seleccion-trabajador.repository';

import { SolicitudDesembolsoRepository } from './CORE/solicitud-desembolso';
import { PostgresSolicitudDesembolsoRepository } from './INFRASTRUCTURE/postgres-solicitud-desembolso.repository';

import { OfertasTrabajadorRepository } from './CORE/ofertas-trabajador';
import { PostgresOfertasTrabajadorRepository } from './INFRASTRUCTURE/postgres-ofertas-trabajador.repository';

export const usuariosProviders: Provider[] = [
UsuariosService,
AutenticacionService,
{
  provide: UsuariosRepository,
  useClass: PostgresUsuariosRepository,
}
];

/**
 * Evita repetir provide/useFactory/inject para cada repositorio.
 * No crea nuevos Pool: solamente comparte el ya existente.
 */
function desdePostgres<T>(token: Type<T>, crear: (pool: Pool) => T): Provider<T> {
  return {
    provide: token,
    useFactory: (db: DbService) => crear(db.pool),
    inject: [DbService],
  };
}

export const casosDeUsoProviders: Provider[] = [
  // Consulta publica de categorias (contrato CORE + implementacion INFRASTRUCTURE).
  ...usuariosProviders,
  SolicitudesService,
  { provide: SolicitudDesembolsoRepository, useClass: PostgresSolicitudDesembolsoRepository },
  SeleccionTrabajadorService,
  { provide: SeleccionTrabajadorRepository, useClass: PostgresSeleccionTrabajadorRepository },
  CotizacionesService,
  ReservaInicialService,
  { provide: ReservaInicialRepository, useClass: PostgresReservaInicialRepository },
  { provide: CotizacionesRepository, useClass: PostgresCotizacionesRepository },
  { provide: SolicitudesRepository, useClass: PostgresSolicitudesRepository },
  PerfilTrabajadorService,
  { provide: PerfilTrabajadorRepository, useClass: PostgresPerfilTrabajadorRepository },
  DocumentoVerificacionService,
  { provide: DocumentoVerificacionRepository, useClass: PostgresDocumentoVerificacionRepository },
  SolicitudDisponibleService,
  { provide: OfertasTrabajadorRepository, useClass: PostgresOfertasTrabajadorRepository },
  PostgresSolicitudDisponibleRepository,
  CuentaTrabajadorService,
  { provide: CuentaTrabajadorRepository, useClass: PostgresCuentaTrabajadorRepository },
  desdePostgres(CancelacionTrabajadorService, (pool) => new CancelacionTrabajadorService(new PostgresCancelacionTrabajadorRepository(pool))),
  desdePostgres(DocumentacionTrabajadorService, (pool) => new DocumentacionTrabajadorService(new PostgresDocumentacionTrabajadorRepository(pool))),
  desdePostgres(GestionReclamosService, (pool) => new GestionReclamosService(new PostgresGestionReclamosRepository(pool))),
  desdePostgres(AprobacionDesembolsosService, (pool) => new AprobacionDesembolsosService(new PostgresAprobacionDesembolsosRepository(pool))),
  CategoriasService,
  { provide: CategoriasRepository,
     useClass: PostgresCategoriasRepository },

  // Funcionalidades privadas (aun requieren autenticacion real).
  desdePostgres(
    CalificacionOpinionService,
    (pool) => new CalificacionOpinionService(new PostgresCalificacionOpinionRepository(pool)),
  ),
  desdePostgres(
    ReclamoFormalService,
    (pool) => new ReclamoFormalService(new PostgresReclamoFormalRepository(pool)),
  ),
  desdePostgres(
    DeclaracionAsistenciaService,
    (pool) => new DeclaracionAsistenciaService(new PostgresDeclaracionAsistenciaRepository(pool)),
  ),
  desdePostgres(
    CancelacionClienteService,
    (pool) => new CancelacionClienteService(new PostgresCancelacionClienteRepository(pool)),
  ),
  desdePostgres(
    RevisionDiscrepanciasPagoService,
    (pool) => new RevisionDiscrepanciasPagoService(new PostgresRevisionDiscrepanciasPagoRepository(pool)),
  ),
  desdePostgres(
    IncidentesSancionesService,
    (pool) => new IncidentesSancionesService(new PostgresIncidentesSancionesRepository(pool)),
  ),
  desdePostgres(
    GestionRevisionAsistenciaService,
    (pool) => new GestionRevisionAsistenciaService(new PostgresGestionRevisionAsistenciaRepository(pool)),
  ),
  desdePostgres(
    RespuestaOpinionService,
    (pool) => new RespuestaOpinionService(new PostgresRespuestaOpinionRepository(pool)),
  ),
  desdePostgres(
    PostgresCandidatosAsistenciaRepository,
    (pool) => new PostgresCandidatosAsistenciaRepository(pool),
  ),

  // CU-20: el controller utiliza SERVICE, nunca directamente PostgreSQL.
  {
    provide: CandidatosAsistenciaService,
    useFactory: (repo: PostgresCandidatosAsistenciaRepository) =>
      new CandidatosAsistenciaService(repo),
    inject: [PostgresCandidatosAsistenciaRepository],
  },

  // CU-06: servicio depende de un repositorio inyectado, no abre conexiones.
  desdePostgres(
    PostgresModificacionPrecioRepository,
    (pool) => new PostgresModificacionPrecioRepository(pool),
  ),
  {
    provide: ModificacionPrecioService,
    useFactory: (repo: PostgresModificacionPrecioRepository) => new ModificacionPrecioService(repo),
    inject: [PostgresModificacionPrecioRepository],
  },

  // Repositorios necesarios para los endpoints de complemento de anticipo.
  desdePostgres(
    PostgresComplementoAnticipoRepository,
    (pool) => new PostgresComplementoAnticipoRepository(pool),
  ),
  desdePostgres(
    PostgresInicioComplementoAnticipoRepository,
    (pool) => new PostgresInicioComplementoAnticipoRepository(pool),
  ),
  {
    provide: ComplementoAnticipoService,
    useFactory: (
      consulta: PostgresComplementoAnticipoRepository,
      inicio: PostgresInicioComplementoAnticipoRepository,
    ) => new ComplementoAnticipoService(consulta, inicio),
    inject: [PostgresComplementoAnticipoRepository, PostgresInicioComplementoAnticipoRepository],
  },
];
