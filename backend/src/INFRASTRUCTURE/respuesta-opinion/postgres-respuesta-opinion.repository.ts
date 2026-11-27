import type { Pool } from 'pg';
import type {
  ContextoRespuestaOpinion,
  DetalleOpinion,
  RespuestaOpinionRegistrada,
  RespuestaOpinionRepository,
} from '../../CORE/respuesta-opinion/respuesta-opinion.repository';

const calificacionVigente = `
  FROM arreglalo.calificacion c
  JOIN arreglalo.v_contratacion vc ON vc.reserva_id = c.reserva_id
  LEFT JOIN LATERAL (
    SELECT v.opinion
    FROM arreglalo.version_calificacion v
    WHERE v.calificacion_id = c.calificacion_id
    ORDER BY v.version DESC
    LIMIT 1
  ) vigente ON true
`;

export class PostgresRespuestaOpinionRepository implements RespuestaOpinionRepository {
  constructor(private readonly pool: Pool) {}

  async consultarOpinion(calificacionId: string, actorId: string): Promise<DetalleOpinion | null> {
    const { rows: [fila] } = await this.pool.query<DetalleOpinion>(
      `
      SELECT c.calificacion_id::text AS "calificacionId",
             c.reserva_id::text AS "reservaId",
             vigente.opinion,
             (
               vc.trabajador_id = $2::bigint
               AND arreglalo.tiene_rol($2::bigint, 'trabajador') IS TRUE
               AND vigente.opinion ~ '[^[:space:]]'
             ) IS TRUE AS "puedeResponder",
             COALESCE((
               SELECT jsonb_agg(
                 jsonb_build_object(
                   'id', r.respuesta_id::text,
                   'autorId', vc.trabajador_id::text,
                   'texto', r.texto,
                   'registradaEn', r.registrada_en
                 ) ORDER BY r.registrada_en, r.respuesta_id
               )
               FROM arreglalo.respuesta_opinion r
               WHERE r.calificacion_id = c.calificacion_id
             ), '[]'::jsonb) AS respuestas
      ${calificacionVigente}
      WHERE c.calificacion_id = $1::bigint
        AND NOT EXISTS (SELECT 1 FROM arreglalo.opinion_invalidada i WHERE i.calificacion_id=c.calificacion_id)
        AND (
          (vc.cliente_id = $2::bigint AND arreglalo.tiene_rol($2::bigint, 'cliente') IS TRUE)
          OR
          (vc.trabajador_id = $2::bigint AND arreglalo.tiene_rol($2::bigint, 'trabajador') IS TRUE)
        )
      `,
      [calificacionId, actorId],
    );

    return fila ?? null;
  }

  async consultarContexto(calificacionId: string): Promise<ContextoRespuestaOpinion | null> {
    const { rows: [fila] } = await this.pool.query<ContextoRespuestaOpinion>(
      `
      SELECT vc.trabajador_id::text AS "trabajadorId",
             vigente.opinion,
             arreglalo.tiene_rol(vc.trabajador_id, 'trabajador') IS TRUE AS "trabajadorActivo"
      ${calificacionVigente}
      WHERE c.calificacion_id = $1::bigint
        AND NOT EXISTS (SELECT 1 FROM arreglalo.opinion_invalidada i WHERE i.calificacion_id=c.calificacion_id)
      `,
      [calificacionId],
    );

    return fila ?? null;
  }

  async registrar(
    calificacionId: string,
    actorId: string,
    texto: string,
  ): Promise<RespuestaOpinionRegistrada | null> {
    const { rows: [fila] } = await this.pool.query<RespuestaOpinionRegistrada>(
      `
      INSERT INTO arreglalo.respuesta_opinion (calificacion_id, texto)
      SELECT c.calificacion_id, $3::text
      ${calificacionVigente}
      WHERE c.calificacion_id = $1::bigint
        AND NOT EXISTS (SELECT 1 FROM arreglalo.opinion_invalidada i WHERE i.calificacion_id=c.calificacion_id)
        AND vc.trabajador_id = $2::bigint
        AND arreglalo.tiene_rol($2::bigint, 'trabajador') IS TRUE
        AND vigente.opinion ~ '[^[:space:]]'
      RETURNING respuesta_id::text AS id,
                calificacion_id::text AS "calificacionId",
                $2::bigint::text AS "autorId",
                texto,
                registrada_en AS "registradaEn"
      `,
      [calificacionId, actorId, texto],
    );

    return fila ?? null;
  }
}
