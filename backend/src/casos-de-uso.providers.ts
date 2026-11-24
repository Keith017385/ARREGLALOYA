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
  CategoriasService,
  { provide: CategoriasRepository, useClass: PostgresCategoriasRepository },

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
];
