import type { Pool, PoolClient } from 'pg';
import type {
  DecisionPrecio,
  PropuestaPrecio,
} from '../CORE/decision-modificacion-precio';
import type {
  ModificacionPrecioRepository,
  OperacionesModificacionPrecio,
  RegistroDecisionPrecio,
} from '../CORE/modificacion-precio.repository';
import type {
  PropuestaPrecioGuardada,
  PropuestaPrecioNueva,
  ReservaParaProponerPrecio,
} from '../CORE/propuesta-modificacion-precio';

interface FilaReserva {
  id: string;
  clienteId: string;
  trabajadorId: string;
  servicioEnPrestacion: boolean;
  precioVigente: string;
  anticipoRecibido: string;
  pagosDirectosConfirmados: string;
}

interface FilaPropuesta {
  id: string;
  reservaId: string;
  variacion: string;
  decision: 'aceptada' | 'rechazada' | null;
}

function leerCentavos(valor: string): number {
  const centavos = Number(valor);

  if (!/^-?\d+(?:\.0+)?$/.test(valor) || !Number.isSafeInteger(centavos)) {
    throw new RangeError('PostgreSQL devolvio un importe invalido en centavos.');
  }

  return centavos;
}

async function obtenerReserva(
  cliente: PoolClient,
  reservaId: string,
): Promise<ReservaParaProponerPrecio | null> {
  const { rows } = await cliente.query<FilaReserva>(
    `
    SELECT
        vc.reserva_id::text AS id,
        vc.cliente_id::text AS "clienteId",
        vc.trabajador_id::text AS "trabajadorId",
        vc.estado = 'en_ejecucion' AS "servicioEnPrestacion",
        (f.precio_final * 100)::text AS "precioVigente",
        (f.recibido * 100)::text AS "anticipoRecibido",
        ((f.precio_final - f.recibido - f.saldo_directo) * 100)::text
            AS "pagosDirectosConfirmados"
    FROM arreglalo.v_contratacion AS vc
    JOIN arreglalo.v_fondo AS f USING (reserva_id)
    WHERE vc.reserva_id = $1::bigint
    `,
    [reservaId],
  );

  const fila = rows[0];
  if (!fila) {
    return null;
  }

  return {
    id: fila.id,
    clienteId: fila.clienteId,
    trabajadorId: fila.trabajadorId,
    servicioEnPrestacion: fila.servicioEnPrestacion,
    precioVigente: leerCentavos(fila.precioVigente),
    anticipoRecibido: leerCentavos(fila.anticipoRecibido),
    pagosDirectosConfirmados: leerCentavos(fila.pagosDirectosConfirmados),
  };
}

async function buscarPropuesta(
  cliente: PoolClient,
  reservaId: string,
  propuestaId: string,
): Promise<PropuestaPrecio | null> {
  const { rows } = await cliente.query<FilaPropuesta>(
    `
    SELECT
        m.modificacion_id::text AS id,
        m.reserva_id::text AS "reservaId",
        (m.importe_variacion * 100)::text AS variacion,
        d.decision
    FROM arreglalo.modificacion_precio AS m
    LEFT JOIN arreglalo.decision_modificacion AS d USING (modificacion_id)
    WHERE m.reserva_id = $1::bigint
      AND m.modificacion_id = $2::bigint
    `,
    [reservaId, propuestaId],
  );

  const fila = rows[0];
  if (!fila) {
    return null;
  }

  const decisionRegistrada: DecisionPrecio | null =
    fila.decision === null
      ? null
      : fila.decision === 'aceptada'
        ? 'ACEPTADA'
        : 'RECHAZADA';

  return {
    id: fila.id,
    reservaId: fila.reservaId,
    variacion: leerCentavos(fila.variacion),
    decisionRegistrada,
  };
}

async function insertarPropuesta(
  cliente: PoolClient,
  propuesta: PropuestaPrecioNueva,
): Promise<PropuestaPrecioGuardada> {
  const { rows } = await cliente.query<{ id: string; propuestaEn: Date }>(
    `
    INSERT INTO arreglalo.modificacion_precio (
        reserva_id, importe_variacion, motivo, proponente_id, propuesta_en
    )
    VALUES ($1::bigint, $2::numeric / 100, $3, $4::bigint, $5)
    RETURNING modificacion_id::text AS id, propuesta_en AS "propuestaEn"
    `,
    [
      propuesta.reservaId,
      propuesta.variacion,
      propuesta.motivo,
      propuesta.proponenteId,
      propuesta.propuestaEn,
    ],
  );

  const fila = rows[0];
  if (!fila) {
    throw new Error('PostgreSQL no devolvio la propuesta guardada.');
  }

  return { ...propuesta, id: fila.id, propuestaEn: fila.propuestaEn };
}

async function insertarDecision(
  cliente: PoolClient,
  reservaId: string,
  registro: RegistroDecisionPrecio,
): Promise<void> {
  const { resultado } = registro;

  if (resultado.decision === 'ACEPTADA' && resultado.precioVigente <= 0) {
    throw new Error('El precio final debe ser mayor que cero.');
  }

  const respuesta = await cliente.query(
    `
    INSERT INTO arreglalo.decision_modificacion (
        modificacion_id, actor_id, decision, decidida_en
    )
    SELECT m.modificacion_id, $3::bigint, $4, $5
    FROM arreglalo.modificacion_precio AS m
    WHERE m.reserva_id = $1::bigint
      AND m.modificacion_id = $2::bigint
    `,
    [
      reservaId,
      resultado.propuestaId,
      registro.actorId,
      resultado.decision.toLowerCase(),
      registro.decididaEn,
    ],
  );

  if (respuesta.rowCount !== 1) {
    throw new Error('No se encontro la propuesta en esta reserva.');
  }
}

export class PostgresModificacionPrecioRepository
  implements ModificacionPrecioRepository {
  constructor(private readonly pool: Pool) {}

  async enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesModificacionPrecio) => Promise<T>,
  ): Promise<T> {
    const cliente = await this.pool.connect();
    let descartarConexion = false;

    try {
      await cliente.query('BEGIN ISOLATION LEVEL READ COMMITTED');

      await cliente.query(
        `
        SELECT reserva_id
        FROM arreglalo.reserva
        WHERE reserva_id = $1::bigint
        FOR UPDATE
        `,
        [reservaId],
      );

      const resultado = await ejecutar({
        obtenerReserva: () => obtenerReserva(cliente, reservaId),
        buscarPropuesta: (id) => buscarPropuesta(cliente, reservaId, id),
        guardarPropuesta: (propuesta) => insertarPropuesta(cliente, propuesta),
        guardarDecision: (registro) => insertarDecision(cliente, reservaId, registro),
      });

      await cliente.query('COMMIT');
      return resultado;
    } catch (error) {
      try {
        await cliente.query('ROLLBACK');
      } catch {
        descartarConexion = true;
      }
      throw error;
    } finally {
      cliente.release(descartarConexion);
    }
  }
}