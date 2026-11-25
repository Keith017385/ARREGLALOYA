BEGIN;
CREATE TABLE IF NOT EXISTS arreglalo.sesion_http (
  sid varchar PRIMARY KEY,
  sess json NOT NULL,
  expire timestamp(6) NOT NULL
);
CREATE INDEX IF NOT EXISTS sesion_http_expire_idx ON arreglalo.sesion_http (expire);
COMMIT;
