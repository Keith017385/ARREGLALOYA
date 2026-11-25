import { ConflictException, ForbiddenException, Injectable } from '@nestjs/common';
import { ReservaConFondo, SolicitudDesembolsoRepository } from '../CORE/solicitud-desembolso';
import { DbService } from './db.service';

const fondos = `
  SELECT vc.reserva_id::text AS id, greatest(0, coalesce(vf.disponible, 0) - coalesce(pendientes.importe, 0))::text AS disponible
  FROM arreglalo.v_contratacion vc
  JOIN arreglalo.v_fondo vf USING (reserva_id)
  LEFT JOIN LATERAL (
    SELECT sum(sf.importe_solicitado) AS importe FROM arreglalo.solicitud_financiera sf
    WHERE sf.reserva_id = vc.reserva_id AND sf.tipo = 'desembolso'
      AND NOT EXISTS (
        SELECT 1 FROM arreglalo.decision_financiera d WHERE d.solicitud_financiera_id = sf.solicitud_financiera_id
      )
  ) pendientes ON true
  WHERE vc.trabajador_id = $1 AND vc.estado IN ('reservada', 'en_ejecucion', 'finalizada')
    AND arreglalo.tiene_rol($1, 'trabajador')
`;

@Injectable()
export class PostgresSolicitudDesembolsoRepository implements SolicitudDesembolsoRepository {
  constructor(private readonly db: DbService) {}

  async listar(trabajadorId: string) {
    const { rows } = await this.db.pool.query<ReservaConFondo>(fondos + ' ORDER BY vc.reserva_id DESC', [trabajadorId]);
    return rows.filter(fila => Number(fila.disponible) > 0);
  }

  async solicitar(trabajadorId: string, reservaId: string, importe: string, archivo: Buffer) {
    const conexion = await this.db.pool.connect();
    try {
      await conexion.query('BEGIN');
      const { rows: [contrato] } = await conexion.query<{ cliente_id: string; trabajador_id: string }>(
        'SELECT cliente_id, trabajador_id FROM arreglalo.v_contratacion WHERE reserva_id = $1 AND trabajador_id = $2',
        [reservaId, trabajadorId],
      );
      if (!contrato) {
        await conexion.query('ROLLBACK');
        return null;
      }
      await conexion.query('SELECT 1 FROM arreglalo.usuario WHERE usuario_id IN ($1, $2) ORDER BY usuario_id FOR UPDATE',
        [contrato.cliente_id, contrato.trabajador_id]);
      await conexion.query('SELECT 1 FROM arreglalo.reserva WHERE reserva_id = $1 FOR UPDATE', [reservaId]);
      const { rows: [fondo] } = await conexion.query<{ suficiente: boolean }>(
        'SELECT disponible::numeric >= $3::numeric AS suficiente FROM (' + fondos + ' AND vc.reserva_id = $2) f',
        [trabajadorId, reservaId, importe],
      );
      if (!fondo?.suficiente) throw new ConflictException('El importe supera el fondo disponible o la reserva no admite desembolsos.');
      const { rows: [solicitud] } = await conexion.query<{ id: string }>(`
        INSERT INTO arreglalo.solicitud_financiera (reserva_id, tipo, importe_solicitado, solicitante_id)
        VALUES ($1, 'desembolso', $2, $3) RETURNING solicitud_financiera_id::text AS id
      `, [reservaId, importe, trabajadorId]);
      await conexion.query('INSERT INTO arreglalo.documento_desembolso VALUES ($1, $2)', [solicitud.id, archivo]);
      await conexion.query('COMMIT');
      return solicitud.id;
    } catch (error) {
      await conexion.query('ROLLBACK');
      throw error;
    } finally {
      conexion.release();
    }
  }

  async documento(administradorId: string, solicitudId: string) {
    const { rows: [permiso] } = await this.db.pool.query<{ autorizado: boolean }>(
      'SELECT arreglalo.es_administrador($1) AS autorizado', [administradorId],
    );
    if (!permiso?.autorizado) throw new ForbiddenException('Se requiere un administrador activo.');
    const { rows: [documento] } = await this.db.pool.query<{ contenido: Buffer }>(
      'SELECT contenido FROM arreglalo.documento_desembolso WHERE solicitud_financiera_id = $1', [solicitudId],
    );
    return documento?.contenido ?? null;
  }
}
