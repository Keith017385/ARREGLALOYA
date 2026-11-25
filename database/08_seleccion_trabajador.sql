BEGIN;
CREATE TABLE IF NOT EXISTS arreglalo.seleccion_trabajador (
  seleccion_id bigint GENERATED ALWAYS AS IDENTITY PRIMARY KEY,
  solicitud_id bigint NOT NULL REFERENCES arreglalo.solicitud ON DELETE RESTRICT,
  trabajador_id bigint NOT NULL REFERENCES arreglalo.trabajador(usuario_id) ON DELETE RESTRICT,
  seleccionada_en timestamptz NOT NULL DEFAULT clock_timestamp()
);
CREATE INDEX IF NOT EXISTS seleccion_trabajador_solicitud_idx
  ON arreglalo.seleccion_trabajador (solicitud_id, seleccion_id DESC);
COMMIT;
