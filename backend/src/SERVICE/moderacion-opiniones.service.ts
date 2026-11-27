
import { Injectable, BadRequestException, ForbiddenException, NotFoundException, ConflictException } from '@nestjs/common';
import { DbService } from '../INFRASTRUCTURE/db.service';
import type { Pool, PoolClient } from 'pg';

export function validarTextoModeracion(valor: unknown): string {
  if (typeof valor !== 'string' || !valor.trim() || valor.trim().length > 2000 || valor.includes('\0')) {
    throw new BadRequestException('Escribe un texto de 1 a 2000 caracteres.');
  }
  return valor.trim();
}

@Injectable()
export class ModeracionOpinionesService {
  constructor(private readonly db: DbService) {}

  private async administrador(db: Pool | PoolClient, actor: string) {
    const { rows: [fila] } = await db.query('SELECT arreglalo.es_administrador($1::bigint) IS TRUE AS permitido', [actor]);
    if (!fila?.permitido) throw new ForbiddenException('Se requiere un administrador activo.');
  }

  async reportar(actor: string, id: string, motivo: unknown) {
    const texto = validarTextoModeracion(motivo);
    const { rows: [fila] } = await this.db.pool.query(`
      INSERT INTO arreglalo.reporte_opinion(calificacion_id, reportante_id, motivo)
      SELECT c.calificacion_id, $2::bigint, $3 FROM arreglalo.calificacion c
      JOIN arreglalo.v_contratacion vc USING(reserva_id)
      WHERE c.calificacion_id=$1::bigint
      AND ((vc.trabajador_id=$2::bigint AND arreglalo.tiene_rol($2::bigint,'trabajador'))
        OR (vc.cliente_id=$2::bigint AND arreglalo.tiene_rol($2::bigint,'cliente')))
      AND NOT EXISTS (SELECT 1 FROM arreglalo.opinion_invalidada i WHERE i.calificacion_id=c.calificacion_id)
      ON CONFLICT (calificacion_id,reportante_id) DO NOTHING
      RETURNING reporte_id::text AS id, estado`, [id,actor,texto]);
    if (!fila) throw new ConflictException('La calificación no está disponible para reportar o ya enviaste un reporte.');
    return fila;
  }

  async listar(actor: string) {
    await this.administrador(this.db.pool,actor);
    const { rows } = await this.db.pool.query(`
      SELECT r.reporte_id::text AS id, r.calificacion_id::text AS "calificacionId",
      r.motivo, r.estado, r.decision, r.fundamento, r.creado_en AS "creadoEn",
      r.responsable_id::text AS "responsableId", r.resuelto_en AS "resueltoEn",
      v.opinion, v.puntuacion, vc.trabajador_id::text AS "trabajadorId"
      FROM arreglalo.reporte_opinion r JOIN arreglalo.calificacion c USING(calificacion_id)
      JOIN arreglalo.v_contratacion vc USING(reserva_id)
      LEFT JOIN LATERAL (SELECT opinion,puntuacion FROM arreglalo.version_calificacion
       WHERE calificacion_id=c.calificacion_id ORDER BY version DESC LIMIT 1) v ON true
      ORDER BY r.creado_en DESC, r.reporte_id DESC LIMIT 200`);
    return rows;
  }

  async revisar(actor: string, id: string, decision?: unknown, fundamento?: unknown) {
    const resolver = decision !== undefined;
    if (resolver && decision !== 'invalidar' && decision !== 'conservar') throw new BadRequestException('Decisión inválida.');
    const texto = resolver ? validarTextoModeracion(fundamento) : null;
    const cliente = await this.db.pool.connect();
    let descartar = false;
    try {
      await cliente.query('BEGIN');
      await this.administrador(cliente,actor);
      const { rows: [reporte] } = await cliente.query(
        'SELECT * FROM arreglalo.reporte_opinion WHERE reporte_id=$1::bigint FOR UPDATE', [id]);
      if (!reporte) throw new NotFoundException('No se encontró el reporte.');
      if (reporte.estado === 'resuelto') throw new ConflictException('El reporte ya fue resuelto.');
      if (resolver && reporte.estado !== 'en_revision') throw new ConflictException('Inicia la revisión antes de resolver.');
      if (resolver) {
        // Serializa decisiones sobre una misma opinión y conserva la calificación original.
        await cliente.query('SELECT calificacion_id FROM arreglalo.calificacion WHERE calificacion_id=$1 FOR UPDATE', [reporte.calificacion_id]);
        if (decision === 'invalidar') await cliente.query(
          'INSERT INTO arreglalo.opinion_invalidada(calificacion_id,reporte_id) VALUES($1,$2) ON CONFLICT DO NOTHING',
          [reporte.calificacion_id,id]);
        await cliente.query(`UPDATE arreglalo.reporte_opinion SET estado='resuelto',
          responsable_id=$2, decision=$3, fundamento=$4, resuelto_en=now() WHERE reporte_id=$1`, [id,actor,decision,texto]);
      } else {
        await cliente.query("UPDATE arreglalo.reporte_opinion SET estado='en_revision', responsable_id=$2 WHERE reporte_id=$1", [id,actor]);
      }
      await cliente.query('COMMIT');
      return { id, estado: resolver ? 'resuelto' : 'en_revision' };
    } catch (error) {
      try { await cliente.query('ROLLBACK'); } catch { descartar = true; }
      throw error;
    } finally { cliente.release(descartar); }
  }

  async reputacion(id: string) {
    const { rows: [fila] } = await this.db.pool.query(
      'SELECT cantidad, promedio::float8 AS promedio FROM arreglalo.v_reputacion_moderada WHERE trabajador_id=$1::bigint', [id]);
    return { trabajadorId: id, cantidad: fila?.cantidad ?? 0, promedio: fila?.promedio ?? null };
  }
}
