import type { Pool, PoolClient } from 'pg';
import type {
  ContratacionParaPagoFinal,
  PagoDirectoRegistrado,
  PagoFinalRepository,
  OperacionesPagoFinal,
} from '../../CORE/pago-final/pago-final.repository';

interface FilaReserva {
  id: string;
  clienteId: string;
  trabajadorId: string;
  estado: string;
  precioFinal: string;
  anticipoRecibido: string;
  pagosDirectosConfirmados: string;
  tieneModificacionPendiente: boolean;
  tienePagoPendiente: boolean;
}

interface FilaPago {
  id: string;
  reservaId: string;
  importeCentavos: string;
  declaradoEn: Date;
  confirmadoEn: Date | null;
}

const columnasPago = `
    pago_directo_id::text AS id,
    reserva_id::text AS "reservaId",
    (importe_declarado::numeric * 100)::text AS "importeCentavos",
    declarado_en AS "declaradoEn",
    confirmado_en AS "confirmadoEn"
`;

function leerCentavos(valor: string): number {
  const centavos = Number(valor);
  if (!/^\d+(?:\.0+)?$/.test(valor) || !Number.isSafeInteger(centavos)) {
    throw new RangeError('PostgreSQL devolvio un importe invalido en centavos.');
  }
  return centavos;
}

function convertirPago(fila: FilaPago): PagoDirectoRegistrado {
  return { ...fila, importeCentavos: leerCentavos(fila.importeCentavos) };
}

async function obtenerReserva(
  cliente: PoolClient,
  reservaId: string,
): Promise<ContratacionParaPagoFinal | null> {
  const { rows: [fila] } = await cliente.query<FilaReserva>(
    `
    SELECT
        vc.reserva_id::text AS id,
        vc.cliente_id::text AS "clienteId",
        vc.trabajador_id::text AS "trabajadorId",
        vc.estado,
        (f.precio_final * 100)::text AS "precioFinal",
        (f.recibido * 100)::text AS "anticipoRecibido",
        ((f.precio_final - f.recibido - f.saldo_directo) * 100)::text
            AS "pagosDirectosConfirmados",
        EXISTS (
            SELECT 1
            FROM arreglalo.modificacion_precio AS m
            WHERE m.reserva_id = vc.reserva_id
              AND NOT EXISTS (
                  SELECT 1
                  FROM arreglalo.decision_modificacion AS d
                  WHERE d.modificacion_id = m.modificacion_id
              )
        ) AS "tieneModificacionPendiente",
        EXISTS (
            SELECT 1
            FROM arreglalo.pago_directo AS p
            WHERE p.reserva_id = vc.reserva_id
              AND p.confirmado_en IS NULL
        ) AS "tienePagoPendiente"
    FROM arreglalo.v_contratacion AS vc
    JOIN arreglalo.v_fondo AS f USING (reserva_id)
    WHERE vc.reserva_id = $1::bigint
    `,
    [reservaId],
  );

  if (!fila) {
    return null;
  }

  return {
    ...fila,
    precioFinal: leerCentavos(fila.precioFinal),
    anticipoRecibido: leerCentavos(fila.anticipoRecibido),
    pagosDirectosConfirmados: leerCentavos(fila.pagosDirectosConfirmados),
  };
}

async function buscarPago(
  cliente: PoolClient,
  reservaId: string,
  pagoId: string,
): Promise<PagoDirectoRegistrado | null> {
  const { rows: [fila] } = await cliente.query<FilaPago>(
    `
    SELECT ${columnasPago}
    FROM arreglalo.pago_directo
    WHERE reserva_id = $1::bigint AND pago_directo_id = $2::bigint
    `,
    [reservaId, pagoId],
  );

  return fila ? convertirPago(fila) : null;
}

async function registrarDeclaracion(
  cliente: PoolClient,
  reservaId: string,
  importeCentavos: number,
): Promise<PagoDirectoRegistrado> {
  const { rows: [fila] } = await cliente.query<FilaPago>(
    `
    INSERT INTO arreglalo.pago_directo (reserva_id, importe_declarado)
    VALUES ($1::bigint, $2::numeric / 100)
    RETURNING ${columnasPago}
    `,
    [reservaId, importeCentavos],
  );

  if (!fila) {
    throw new Error('PostgreSQL no devolvio el pago declarado.');
  }

  return convertirPago(fila);
}

async function consultarUltimoPago(
  cliente: PoolClient,
  reservaId: string,
  actorId: string,
) {
  const { rows: [fila] } = await cliente.query<FilaPago & {
    enRevision: boolean;
    yaSolicitoRevision: boolean;
  }>(
    `
    SELECT ${columnasPago},
        EXISTS (
          SELECT 1
          FROM arreglalo.discrepancia_pago_directo d
          WHERE d.pago_directo_id = p.pago_directo_id
        ) AS "enRevision",
        EXISTS (
          SELECT 1
          FROM arreglalo.discrepancia_pago_directo d
          WHERE d.pago_directo_id = p.pago_directo_id
            AND d.solicitante_id = $2::bigint
        ) AS "yaSolicitoRevision"
    FROM arreglalo.pago_directo p
    WHERE p.reserva_id = $1::bigint
    ORDER BY p.declarado_en DESC, p.pago_directo_id DESC
    LIMIT 1
    `,
    [reservaId, actorId],
  );

  if (!fila) {
    return { pagoRegistrado: null, enRevision: false, yaSolicitoRevision: false };
  }

  const { enRevision, yaSolicitoRevision, ...pago } = fila;
  return {
    pagoRegistrado: convertirPago(pago),
    enRevision: pago.confirmadoEn === null && enRevision,
    yaSolicitoRevision,
  };
}

async function consultarPlazo(cliente: PoolClient, reservaId: string) {
  const { rows: [fila] } = await cliente.query<{ finalizadaEn: Date | null; ahora: Date }>(
    `
    SELECT (
        SELECT max(f.confirmada_en)
        FROM arreglalo.finalizacion f
        JOIN arreglalo.codigo_finalizacion c USING (codigo_id)
        WHERE c.reserva_id = $1::bigint
      ) AS "finalizadaEn",
      clock_timestamp() AS ahora
    `,
    [reservaId],
  );
  return fila;
}

async function registrarDiscrepancia(
  cliente: PoolClient,
  datos: Parameters<OperacionesPagoFinal['registrarDiscrepancia']>[0],
) {
  const { rows: [fila] } = await cliente.query<{
    id: string;
    pagoId: string;
    solicitadaEn: Date;
  }>(
    `
    INSERT INTO arreglalo.discrepancia_pago_directo
      (pago_directo_id, solicitante_id, declaracion, importe_reportado, solicitada_en)
    VALUES ($1::bigint, $2::bigint, $3, $4::numeric / 100, $5::timestamptz)
    ON CONFLICT ON CONSTRAINT discrepancia_pago_directo_solicitante_uk DO NOTHING
    RETURNING discrepancia_id::text AS id,
              pago_directo_id::text AS "pagoId",
              solicitada_en AS "solicitadaEn"
    `,
    [datos.pagoId, datos.solicitanteId, datos.declaracion, datos.importeCentavos, datos.solicitadaEn],
  );

  if (!fila) {
    throw new Error('Ya solicitaste revision de este pago.');
  }
  return fila;
}

async function confirmarPago(
  cliente: PoolClient,
  reservaId: string,
  pagoId: string,
): Promise<PagoDirectoRegistrado> {
  const { rows: [fila] } = await cliente.query<FilaPago>(
    `
    UPDATE arreglalo.pago_directo
    SET confirmado_en = clock_timestamp()
    WHERE reserva_id = $1::bigint
      AND pago_directo_id = $2::bigint
      AND confirmado_en IS NULL
      AND NOT EXISTS (
        SELECT 1
        FROM arreglalo.discrepancia_pago_directo AS d
        WHERE d.pago_directo_id = pago_directo.pago_directo_id
      )
    RETURNING ${columnasPago}
    `,
    [reservaId, pagoId],
  );

  if (!fila) {
    const { rows: [estado] } = await cliente.query<{ enRevision: boolean }>(
      `
      SELECT EXISTS (
        SELECT 1 FROM arreglalo.discrepancia_pago_directo
        WHERE pago_directo_id = $1::bigint
      ) AS "enRevision"
      `,
      [pagoId],
    );
    if (estado.enRevision) {
      throw new Error('El pago esta pendiente de revision administrativa.');
    }
    throw new Error('El pago ya no esta pendiente de confirmacion.');
  }

  return convertirPago(fila);
}

export class PostgresPagoFinalRepository implements PagoFinalRepository {
  constructor(private readonly pool: Pool) {}

  async enReserva<T>(
    reservaId: string,
    ejecutar: (operaciones: OperacionesPagoFinal) => Promise<T>,
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
        buscarPago: (id) => buscarPago(cliente, reservaId, id),
        registrarDeclaracion: (importe) =>
          registrarDeclaracion(cliente, reservaId, importe),
        confirmarPago: (id) => confirmarPago(cliente, reservaId, id),
        consultarUltimoPago: (actorId) => consultarUltimoPago(cliente, reservaId, actorId),
        consultarPlazo: () => consultarPlazo(cliente, reservaId),
        registrarDiscrepancia: (datos) => registrarDiscrepancia(cliente, datos),
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