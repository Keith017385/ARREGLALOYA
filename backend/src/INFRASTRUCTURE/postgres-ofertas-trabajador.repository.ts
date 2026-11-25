import { ConflictException, Injectable, NotFoundException } from '@nestjs/common';
import type { PoolClient } from 'pg';
import { NuevaCotizacion, OfertaTrabajador, OfertasTrabajadorRepository } from '../CORE/ofertas-trabajador';
import { DbService } from './db.service';

@Injectable()
export class PostgresOfertasTrabajadorRepository implements OfertasTrabajadorRepository {
  constructor(private readonly db: DbService) {}

  async listar(trabajadorId: string) {
    const { rows } = await this.db.pool.query<OfertaTrabajador>(`
      SELECT o.oferta_id::text AS id, s.solicitud_id::text AS "solicitudId", s.descripcion, o.estado,
        v.visita_id::text AS "visitaId", v.estado AS "estadoVisita", v.programada_en AS "visitaProgramada",
        c.cotizacion_id::text AS "cotizacionId", d.decision, r.reserva_id::text AS "reservaId"
      FROM arreglalo.oferta o
      JOIN arreglalo.solicitud s USING (solicitud_id)
      LEFT JOIN LATERAL (SELECT * FROM arreglalo.visita WHERE oferta_id = o.oferta_id ORDER BY visita_id DESC LIMIT 1) v ON true
      LEFT JOIN LATERAL (SELECT * FROM arreglalo.cotizacion WHERE visita_id = v.visita_id ORDER BY version DESC LIMIT 1) c ON true
      LEFT JOIN arreglalo.decision_cotizacion d USING (cotizacion_id)
      LEFT JOIN arreglalo.reserva r USING (cotizacion_id)
      WHERE o.trabajador_id = $1 ORDER BY o.oferta_id DESC
    `, [trabajadorId]);
    return rows;
  }

  presentar(trabajadorId: string, solicitudId: string) {
    return this.transaccion(async conexion => {
      const { rows: [solicitud] } = await conexion.query(
        'SELECT estado FROM arreglalo.solicitud WHERE solicitud_id = $1 FOR UPDATE', [solicitudId],
      );
      if (solicitud?.estado !== 'publicada') throw new ConflictException('La solicitud ya no admite ofertas.');
      const { rows: [previa] } = await conexion.query<{ id: string }>(`
        SELECT oferta_id::text AS id FROM arreglalo.oferta
        WHERE solicitud_id = $1 AND trabajador_id = $2 AND estado IN ('presentada', 'seleccionada')
        ORDER BY oferta_id DESC LIMIT 1
      `, [solicitudId, trabajadorId]);
      if (previa) return previa.id;
      const { rows: [oferta] } = await conexion.query<{ id: string }>(`
        INSERT INTO arreglalo.oferta (solicitud_id, trabajador_id)
        SELECT s.solicitud_id, t.usuario_id FROM arreglalo.solicitud s
        JOIN arreglalo.trabajador t ON t.usuario_id = $2 AND t.zona_id = s.zona_id
        WHERE s.solicitud_id = $1 AND s.cliente_id <> t.usuario_id AND arreglalo.tiene_rol($2, 'trabajador')
          AND EXISTS (SELECT 1 FROM arreglalo.servicio_solicitado WHERE solicitud_id = s.solicitud_id)
          AND NOT EXISTS (
            SELECT 1 FROM arreglalo.servicio_solicitado ss
            WHERE ss.solicitud_id = s.solicitud_id AND NOT EXISTS (
              SELECT 1 FROM arreglalo.trabajador_categoria tc
              WHERE tc.trabajador_id = t.usuario_id AND tc.categoria_id = ss.categoria_id
            )
          )
        RETURNING oferta_id::text AS id
      `, [solicitudId, trabajadorId]);
      if (!oferta) throw new ConflictException('La solicitud no coincide con tu zona o servicios.');
      return oferta.id;
    });
  }

  programarVisita(trabajadorId: string, ofertaId: string, fecha: Date) {
    return this.transaccion(async conexion => {
      await this.validarOferta(conexion, trabajadorId, ofertaId);
      const { rows: [previa] } = await conexion.query(`
        SELECT 1 FROM arreglalo.visita WHERE oferta_id = $1 AND estado <> 'cancelada' LIMIT 1
      `, [ofertaId]);
      if (previa) throw new ConflictException('La oferta ya tiene una visita.');
      const { rows: [visita] } = await conexion.query<{ id: string }>(`
        INSERT INTO arreglalo.visita (oferta_id, programada_en) VALUES ($1, $2) RETURNING visita_id::text AS id
      `, [ofertaId, fecha]);
      return visita.id;
    });
  }

  registrarVisita(trabajadorId: string, ofertaId: string) {
    return this.transaccion(async conexion => {
      await this.validarOferta(conexion, trabajadorId, ofertaId);
      const { rowCount } = await conexion.query(`
        UPDATE arreglalo.visita SET estado = 'realizada', realizada_en = clock_timestamp()
        WHERE oferta_id = $1 AND estado = 'programada' AND programada_en <= clock_timestamp()
      `, [ofertaId]);
      if (!rowCount) throw new ConflictException('Espera a la hora programada para registrar la visita.');
    });
  }

  cotizar(trabajadorId: string, ofertaId: string, datos: NuevaCotizacion) {
    return this.transaccion(async conexion => {
      await this.validarOferta(conexion, trabajadorId, ofertaId);
      const { rows: [visita] } = await conexion.query<{ id: string }>(`
        SELECT visita_id::text AS id FROM arreglalo.visita
        WHERE oferta_id = $1 AND estado = 'realizada' ORDER BY visita_id DESC LIMIT 1
      `, [ofertaId]);
      if (!visita) throw new ConflictException('Registra primero la visita realizada.');
      const { rows: [cotizacion] } = await conexion.query<{ id: string }>(`
        INSERT INTO arreglalo.cotizacion (visita_id, version, regla_id, mano_obra, materiales, transporte, vence_en)
        SELECT $1, coalesce((SELECT max(version) FROM arreglalo.cotizacion WHERE visita_id = $1), 0) + 1,
          regla_id, $2, $3, $4, $5
        FROM arreglalo.regla_financiera ORDER BY registrada_en DESC, regla_id DESC LIMIT 1
        RETURNING cotizacion_id::text AS id
      `, [visita.id, datos.manoObra, datos.materiales, datos.transporte, datos.venceEn]);
      if (!cotizacion) throw new ConflictException('No existe una regla financiera vigente.');
      return cotizacion.id;
    });
  }

  private async validarOferta(conexion: PoolClient, trabajadorId: string, ofertaId: string) {
    const { rows: [oferta] } = await conexion.query(`
      SELECT s.estado AS solicitud, o.estado AS oferta FROM arreglalo.oferta o
      JOIN arreglalo.solicitud s USING (solicitud_id)
      WHERE o.oferta_id = $1 AND o.trabajador_id = $2 AND arreglalo.tiene_rol($2, 'trabajador')
      FOR UPDATE OF s, o
    `, [ofertaId, trabajadorId]);
    if (!oferta) throw new NotFoundException('Oferta no encontrada.');
    if (oferta.solicitud !== 'publicada' || oferta.oferta !== 'presentada') {
      throw new ConflictException('La oferta ya no admite cambios.');
    }
  }

  private async transaccion<T>(accion: (conexion: PoolClient) => Promise<T>): Promise<T> {
    const conexion = await this.db.pool.connect();
    try {
      await conexion.query('BEGIN');
      const resultado = await accion(conexion);
      await conexion.query('COMMIT');
      return resultado;
    } catch (error) {
      await conexion.query('ROLLBACK');
      throw error;
    } finally {
      conexion.release();
    }
  }
}
