import type { Pool } from 'pg';
import type { DatosSancion } from '../../CORE/incidentes-sanciones/incidentes-sanciones';
import type {
  ConfirmacionIncidente,
  ConsultaIncidente,
  DetalleIncidente,
  IncidenteRegistrado,
  IncidentesSancionesRepository,
  RegistroIncidente,
  RegistroSancion,
} from '../../CORE/incidentes-sanciones/incidentes-sanciones.repository';

export class PostgresIncidentesSancionesRepository implements IncidentesSancionesRepository {
  constructor(private readonly pool: Pool) {}

  async consultarIncidente(incidenteId: string, actorId: string): Promise<ConsultaIncidente> {
    type FilaConsulta =
      | { autorizado: boolean; id: null }
      | (DetalleIncidente & { autorizado: boolean });

    const { rows: [fila] } = await this.pool.query<FilaConsulta>(
      `
      WITH permiso AS MATERIALIZED (
        SELECT arreglalo.es_administrador($2::bigint) IS TRUE AS autorizado
      )
      SELECT permiso.autorizado,
             detalle.*
      FROM permiso
      LEFT JOIN LATERAL (
        SELECT i.incidente_id::text AS id,
               i.reserva_id::text AS "reservaId",
               i.descripcion,
               i.registrado_en AS "registradoEn",
               i.confirmado_en AS "confirmadoEn",
               i.registrado_por_id::text AS "registradoPorId",
               i.confirmado_por_id::text AS "confirmadoPorId",
               COALESCE((
                 SELECT jsonb_agg(
                   jsonb_build_object(
                     'usuarioId', iu.usuario_id::text,
                     'participacion', iu.participacion
                   ) ORDER BY iu.usuario_id
                 )
                 FROM arreglalo.incidente_usuario iu
                 WHERE iu.incidente_id = i.incidente_id
               ), '[]'::jsonb) AS participantes
        FROM arreglalo.incidente i
        WHERE permiso.autorizado
          AND i.incidente_id = $1::bigint
      ) detalle ON true
      `,
      [incidenteId, actorId],
    );

    if (!fila.autorizado) {
      return { estado: 'sin_permiso' };
    }
    if (fila.id === null) {
      return { estado: 'incidente_inexistente' };
    }

    const { autorizado, ...incidente } = fila;
    return { estado: 'encontrado', incidente };
  }

  async confirmarIncidente(
    incidenteId: string,
    actorId: string,
  ): Promise<ConfirmacionIncidente> {
    const { rows: [fila] } = await this.pool.query<{
      autorizado: boolean;
      existe: boolean;
      confirmadoEn: Date | null;
      confirmadoPorId: string | null;
    }>(
      `
      WITH permiso AS MATERIALIZED (
        SELECT arreglalo.es_administrador($2::bigint) IS TRUE AS autorizado
      ),
      actualizado AS (
        UPDATE arreglalo.incidente i
        SET confirmado_en = clock_timestamp(),
            confirmado_por_id = $2::bigint
        FROM permiso
        WHERE permiso.autorizado
          AND i.incidente_id = $1::bigint
          AND i.confirmado_en IS NULL
        RETURNING i.confirmado_en, i.confirmado_por_id
      )
      SELECT permiso.autorizado,
             permiso.autorizado AND EXISTS (
               SELECT 1 FROM arreglalo.incidente i
               WHERE i.incidente_id = $1::bigint
             ) AS existe,
             actualizado.confirmado_en AS "confirmadoEn",
             actualizado.confirmado_por_id::text AS "confirmadoPorId"
      FROM permiso
      LEFT JOIN actualizado ON true
      `,
      [incidenteId, actorId],
    );

    if (!fila.autorizado) {
      return { estado: 'sin_permiso' };
    }
    if (fila.confirmadoEn !== null && fila.confirmadoPorId !== null) {
      return {
        estado: 'confirmado',
        incidenteId,
        confirmadoEn: fila.confirmadoEn,
        confirmadoPorId: fila.confirmadoPorId,
      };
    }

    return fila.existe
      ? { estado: 'ya_confirmado' }
      : { estado: 'incidente_inexistente' };
  }

  async registrarSancion(
    incidenteId: string,
    usuarioId: string,
    actorId: string,
    datos: DatosSancion,
  ): Promise<RegistroSancion> {
    const { rows: [fila] } = await this.pool.query<{
      autorizado: boolean;
      existe: boolean;
      confirmado: boolean;
      vinculado: boolean;
      id: string | null;
      inicio: Date | null;
      fin: Date | null;
    }>(
      `
      WITH permiso AS MATERIALIZED (
        SELECT arreglalo.es_administrador($3::bigint) IS TRUE AS autorizado
      ),
      incidente AS MATERIALIZED (
        SELECT i.incidente_id,
               i.confirmado_en IS NOT NULL AS confirmado,
               EXISTS (
                 SELECT 1
                 FROM arreglalo.incidente_usuario iu
                 WHERE iu.incidente_id = i.incidente_id
                   AND iu.usuario_id = $2::bigint
               ) AS vinculado
        FROM arreglalo.incidente i
        CROSS JOIN permiso
        WHERE permiso.autorizado AND i.incidente_id = $1::bigint
      ),
      nueva AS (
        INSERT INTO arreglalo.sancion
          (incidente_id, usuario_id, aplicada_por_id, motivo, inicio, fin)
        SELECT i.incidente_id, $2::bigint, $3::bigint, $4::text,
               $5::timestamptz, $6::timestamptz
        FROM incidente i
        WHERE i.confirmado AND i.vinculado
        RETURNING sancion_id, inicio, fin
      )
      SELECT permiso.autorizado,
             i.incidente_id IS NOT NULL AS existe,
             COALESCE(i.confirmado, false) AS confirmado,
             COALESCE(i.vinculado, false) AS vinculado,
             n.sancion_id::text AS id, n.inicio, n.fin
      FROM permiso
      LEFT JOIN incidente i ON true
      LEFT JOIN nueva n ON true
      `,
      [incidenteId, usuarioId, actorId, datos.motivo, datos.inicio, datos.fin],
    );

    if (!fila.autorizado) {
      return { estado: 'sin_permiso' };
    }
    if (!fila.existe) {
      return { estado: 'incidente_inexistente' };
    }
    if (!fila.confirmado) {
      return { estado: 'incidente_no_confirmado' };
    }
    if (!fila.vinculado) {
      return { estado: 'usuario_no_vinculado' };
    }
    if (fila.id === null || fila.inicio === null || fila.fin === null) {
      throw new Error('PostgreSQL no devolvio la sancion registrada.');
    }

    return {
      estado: 'registrada',
      sancion: {
        id: fila.id,
        incidenteId,
        usuarioId,
        aplicadaPorId: actorId,
        motivo: datos.motivo,
        inicio: fila.inicio,
        fin: fila.fin,
      },
    };
  }

  async registrarIncidente(
    reservaId: string,
    actorId: string,
    descripcion: string,
  ): Promise<RegistroIncidente> {
    const { rows: [fila] } = await this.pool.query<{
      autorizado: boolean;
      incidente: (Omit<IncidenteRegistrado, 'registradoEn' | 'confirmadoEn'> & {
        registradoEn: string;
        confirmadoEn: null;
      }) | null;
    }>(
      `
      WITH permiso AS MATERIALIZED (
        SELECT arreglalo.es_administrador($2::bigint) IS TRUE AS autorizado
      ),
      contratacion AS MATERIALIZED (
        SELECT vc.reserva_id, vc.cliente_id, vc.trabajador_id
        FROM arreglalo.v_contratacion vc
        CROSS JOIN permiso
        WHERE vc.reserva_id = $1::bigint AND permiso.autorizado
      ),
      nuevo AS (
        INSERT INTO arreglalo.incidente (reserva_id, descripcion, registrado_por_id)
        SELECT reserva_id, $3::text, $2::bigint FROM contratacion
        RETURNING incidente_id, reserva_id, descripcion, registrado_en, confirmado_en,
                  registrado_por_id, confirmado_por_id
      ),
      vinculos AS (
        INSERT INTO arreglalo.incidente_usuario (incidente_id, usuario_id, participacion)
        SELECT n.incidente_id, c.cliente_id,
               CASE WHEN c.cliente_id = c.trabajador_id
                    THEN 'cliente_y_trabajador' ELSE 'cliente' END
        FROM nuevo n
        JOIN contratacion c USING (reserva_id)
        UNION ALL
        SELECT n.incidente_id, c.trabajador_id, 'trabajador'
        FROM nuevo n
        JOIN contratacion c USING (reserva_id)
        WHERE c.trabajador_id <> c.cliente_id
      )
      SELECT permiso.autorizado,
             CASE WHEN n.incidente_id IS NOT NULL THEN jsonb_build_object(
               'id', n.incidente_id::text,
               'reservaId', n.reserva_id::text,
               'descripcion', n.descripcion,
               'registradoEn', n.registrado_en,
               'confirmadoEn', n.confirmado_en,
               'registradoPorId', n.registrado_por_id::text,
               'confirmadoPorId', n.confirmado_por_id::text
             ) END AS incidente
      FROM permiso
      LEFT JOIN nuevo n ON true
      `,
      [reservaId, actorId, descripcion],
    );

    if (!fila.autorizado) {
      return { estado: 'sin_permiso' };
    }

    if (!fila.incidente) {
      return { estado: 'reserva_inexistente' };
    }

    return {
      estado: 'registrado',
      incidente: {
        ...fila.incidente,
        registradoEn: new Date(fila.incidente.registradoEn),
      },
    };
  }
}
