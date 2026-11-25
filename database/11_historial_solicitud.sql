BEGIN;
CREATE TABLE IF NOT EXISTS arreglalo.historial_solicitud (
  historial_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id bigint NOT NULL REFERENCES arreglalo.solicitud ON DELETE RESTRICT,
  registrada_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  estado text NOT NULL,
  campos text[] NOT NULL
);
CREATE INDEX IF NOT EXISTS historial_solicitud_indice ON arreglalo.historial_solicitud (solicitud_id, historial_id);
CREATE OR REPLACE FUNCTION arreglalo.auditar_solicitud() RETURNS trigger
LANGUAGE plpgsql SET search_path = arreglalo, pg_temp AS $$
BEGIN
  INSERT INTO historial_solicitud (solicitud_id, estado, campos)
  SELECT NEW.solicitud_id, NEW.estado, array_agg(actual.key ORDER BY actual.key)
  FROM jsonb_each(to_jsonb(NEW)) actual
  JOIN jsonb_each(to_jsonb(OLD)) anterior USING (key)
  WHERE actual.value IS DISTINCT FROM anterior.value
  HAVING count(*) > 0;
  RETURN NEW;
END;
$$;
CREATE OR REPLACE TRIGGER auditar_solicitud AFTER UPDATE ON arreglalo.solicitud
FOR EACH ROW EXECUTE FUNCTION arreglalo.auditar_solicitud();
COMMIT;
