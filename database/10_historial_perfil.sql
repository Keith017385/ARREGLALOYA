BEGIN;
CREATE TABLE IF NOT EXISTS arreglalo.historial_perfil_usuario (
  historial_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  usuario_id bigint NOT NULL REFERENCES arreglalo.usuario ON DELETE RESTRICT,
  modificado_en timestamptz NOT NULL DEFAULT clock_timestamp(),
  campos text[] NOT NULL
);

CREATE OR REPLACE FUNCTION arreglalo.auditar_perfil_usuario() RETURNS trigger
LANGUAGE plpgsql SET search_path = arreglalo, pg_temp AS $$
BEGIN
  INSERT INTO historial_perfil_usuario (usuario_id, campos)
  SELECT NEW.usuario_id, array_agg(actual.key ORDER BY actual.key)
  FROM jsonb_each(to_jsonb(NEW)) actual
  JOIN jsonb_each(to_jsonb(OLD)) anterior USING (key)
  WHERE actual.value IS DISTINCT FROM anterior.value
  HAVING count(*) > 0;
  RETURN NEW;
END;
$$;

CREATE OR REPLACE TRIGGER auditar_perfil_usuario AFTER UPDATE ON arreglalo.perfil_usuario
FOR EACH ROW EXECUTE FUNCTION arreglalo.auditar_perfil_usuario();
COMMIT;
