BEGIN;

-- Una solicitud financiera puede recibir una sola decisión, sea aprobada o rechazada.
-- Si el esquema ya tiene una restricción/índice UNIQUE equivalente, no crea otro.
DO $$
DECLARE
  v_attnum smallint;
  v_tiene_unico boolean;
BEGIN
  SELECT a.attnum
    INTO v_attnum
  FROM pg_attribute a
  WHERE a.attrelid = 'arreglalo.decision_financiera'::regclass
    AND a.attname = 'solicitud_financiera_id'
    AND NOT a.attisdropped;

  IF v_attnum IS NULL THEN
    RAISE EXCEPTION 'No existe decision_financiera.solicitud_financiera_id';
  END IF;

  SELECT EXISTS (
    SELECT 1
    FROM pg_index i
    JOIN pg_class t ON t.oid = i.indrelid
    JOIN pg_namespace n ON n.oid = t.relnamespace
    WHERE n.nspname = 'arreglalo'
      AND t.relname = 'decision_financiera'
      AND i.indisunique
      AND i.indisvalid
      AND i.indpred IS NULL
      AND i.indnkeyatts = 1
      AND i.indkey[0] = v_attnum
  ) INTO v_tiene_unico;

  IF NOT v_tiene_unico THEN
    IF EXISTS (
      SELECT 1
      FROM arreglalo.decision_financiera
      GROUP BY solicitud_financiera_id
      HAVING COUNT(*) > 1
    ) THEN
      RAISE EXCEPTION 'Hay decisiones financieras duplicadas. Depure esos registros antes de crear la restricción UNIQUE.';
    END IF;

    CREATE UNIQUE INDEX uq_decision_financiera_solicitud_unica
      ON arreglalo.decision_financiera (solicitud_financiera_id);
  END IF;
END;
$$;

-- Valida las condiciones de una transferencia de tipo desembolso también cuando
-- decision_financiera se modifica fuera del endpoint NestJS.
CREATE OR REPLACE FUNCTION arreglalo.validar_condiciones_desembolso()
RETURNS trigger
LANGUAGE plpgsql
AS $$
DECLARE
  v_tipo text;
  v_reserva_id bigint;
  v_estado text;
  v_solicitado numeric;
  v_disponible numeric := 0;
  v_otros_pendientes numeric := 0;
  v_maximo numeric := 0;
BEGIN
  -- Rechazar no mueve fondos; conserva el flujo de decisión administrativo.
  IF NEW.decision <> 'aprobada' THEN
    RETURN NEW;
  END IF;

  SELECT sf.tipo, sf.reserva_id, sf.importe_solicitado::numeric
    INTO v_tipo, v_reserva_id, v_solicitado
  FROM arreglalo.solicitud_financiera sf
  WHERE sf.solicitud_financiera_id = NEW.solicitud_financiera_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No existe la solicitud financiera indicada.';
  END IF;

  -- No modifica las reglas de reembolsos u otros tipos de solicitud financiera.
  IF v_tipo <> 'desembolso' THEN
    RETURN NEW;
  END IF;

  -- Serializa decisiones distintas que compiten por el fondo de la misma reserva.
  PERFORM 1
  FROM arreglalo.reserva r
  WHERE r.reserva_id = v_reserva_id
  FOR UPDATE;

  IF NOT FOUND THEN
    RAISE EXCEPTION 'No se encontró la reserva del desembolso.';
  END IF;

  SELECT r.estado
    INTO v_estado
  FROM arreglalo.reserva r
  WHERE r.reserva_id = v_reserva_id;

  IF v_estado NOT IN ('reservada', 'en_ejecucion', 'finalizada') THEN
    RAISE EXCEPTION 'La reserva no admite desembolsos en su estado actual.';
  END IF;

  IF NOT EXISTS (
    SELECT 1
    FROM arreglalo.documento_desembolso dd
    WHERE dd.solicitud_financiera_id = NEW.solicitud_financiera_id
  ) THEN
    RAISE EXCEPTION 'La solicitud no tiene un documento PDF de respaldo.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM arreglalo.reclamo_operacion ro
    JOIN arreglalo.reclamo rec USING (reclamo_id)
    WHERE ro.solicitud_financiera_id = NEW.solicitud_financiera_id
      AND rec.estado = 'en_revision'
  ) THEN
    RAISE EXCEPTION 'No se puede autorizar mientras exista un reclamo vinculado en revisión.';
  END IF;

  IF EXISTS (
    SELECT 1
    FROM arreglalo.movimiento_financiero mf
    WHERE mf.solicitud_financiera_id = NEW.solicitud_financiera_id
  ) THEN
    RAISE EXCEPTION 'La solicitud ya tiene un movimiento financiero asociado; requiere conciliación.';
  END IF;

  SELECT COALESCE(vf.disponible::numeric, 0)
    INTO v_disponible
  FROM arreglalo.v_fondo vf
  WHERE vf.reserva_id = v_reserva_id;

  SELECT COALESCE(SUM(otra.importe_solicitado::numeric), 0)
    INTO v_otros_pendientes
  FROM arreglalo.solicitud_financiera otra
  WHERE otra.reserva_id = v_reserva_id
    AND otra.tipo = 'desembolso'
    AND otra.solicitud_financiera_id <> NEW.solicitud_financiera_id
    AND NOT EXISTS (
      SELECT 1
      FROM arreglalo.decision_financiera d
      WHERE d.solicitud_financiera_id = otra.solicitud_financiera_id
    );

  v_maximo := GREATEST(0::numeric, COALESCE(v_disponible, 0) - v_otros_pendientes);
  v_maximo := LEAST(v_maximo, v_solicitado);

  IF NEW.importe_autorizado IS NULL OR NEW.importe_autorizado <= 0 THEN
    RAISE EXCEPTION 'El importe autorizado debe ser positivo.';
  END IF;

  IF NEW.importe_autorizado > v_solicitado THEN
    RAISE EXCEPTION 'El importe autorizado supera el importe solicitado.';
  END IF;

  IF NEW.importe_autorizado > v_maximo THEN
    RAISE EXCEPTION 'El importe autorizado supera el máximo disponible para la solicitud.';
  END IF;

  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_validar_condiciones_desembolso
  ON arreglalo.decision_financiera;

CREATE TRIGGER trg_validar_condiciones_desembolso
BEFORE INSERT ON arreglalo.decision_financiera
FOR EACH ROW
EXECUTE FUNCTION arreglalo.validar_condiciones_desembolso();

COMMIT;
