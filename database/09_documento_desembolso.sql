BEGIN;
CREATE TABLE IF NOT EXISTS arreglalo.documento_desembolso (
  solicitud_financiera_id bigint PRIMARY KEY
    REFERENCES arreglalo.solicitud_financiera ON DELETE RESTRICT,
  contenido bytea NOT NULL CHECK (octet_length(contenido) BETWEEN 5 AND 5242880)
);
COMMIT;
